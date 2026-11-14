import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  getActivePaymentGateway,
  cleanEnvVar,
  getRazorpayBaseUrl,
} from "../lib/razorpay/razorpayConfig";
import { createUnifiedPaymentOrder } from "../lib/payments/unifiedPaymentService";
import {
  verifyRazorpayPayment,
  handleRazorpayWebhookPayload,
  recordRazorpayCheckoutFailure,
  createRazorpayPaymentOrder,
} from "../lib/razorpay/razorpayService";
import { logger } from "../lib/logger";

const router = Router();

/**
 * GET /api/payments/gateway-info
 * Returns the currently active payment gateway configured via environment variables.
 */
router.get("/payments/gateway-info", (req: Request, res: Response) => {
  const activeGateway = getActivePaymentGateway();
  return res.json({
    activeGateway,
    supportedGateways: ["razorpay", "cashfree"],
  });
});

/**
 * GET /api/payments/gateway-diagnostics
 * Safe operational diagnostic endpoint reporting gateway readiness, credentials presence,
 * environment mode, and server build identifier without exposing any secrets or keys.
 */
router.get("/payments/gateway-diagnostics", (_req: Request, res: Response) => {
  const activeGateway = getActivePaymentGateway();
  const rzpKeyId = cleanEnvVar(process.env.RAZORPAY_KEY_ID);
  const rzpKeySecret = cleanEnvVar(process.env.RAZORPAY_KEY_SECRET);
  const rzpWebhookSecret = cleanEnvVar(process.env.RAZORPAY_WEBHOOK_SECRET);

  const cfAppId = cleanEnvVar(process.env.CASHFREE_APP_ID);
  const cfSecretKey = cleanEnvVar(process.env.CASHFREE_SECRET_KEY);
  const cfEnv = cleanEnvVar(process.env.CASHFREE_ENV);

  let keyPrefix = "none";
  let keyEnvironment: "production" | "sandbox" | "unconfigured" = "unconfigured";
  if (rzpKeyId) {
    if (rzpKeyId.startsWith("rzp_live_")) {
      keyPrefix = "rzp_live_";
      keyEnvironment = "production";
    } else if (rzpKeyId.startsWith("rzp_test_")) {
      keyPrefix = "rzp_test_";
      keyEnvironment = "sandbox";
    } else {
      keyPrefix = "custom";
      keyEnvironment = "sandbox";
    }
  }

  let razorpayBaseHost = "api.razorpay.com";
  try {
    const url = new URL(getRazorpayBaseUrl());
    razorpayBaseHost = url.hostname;
  } catch {
    // fallback
  }

  return res.status(200).json({
    status: "ok",
    activeGateway,
    supportedGateways: ["razorpay", "cashfree"],
    razorpay: {
      hasKeyId: Boolean(rzpKeyId),
      hasKeySecret: Boolean(rzpKeySecret),
      hasWebhookSecret: Boolean(rzpWebhookSecret),
      keyEnvironment,
      keyPrefix,
      apiBaseUrlHost: razorpayBaseHost,
    },
    cashfree: {
      hasAppId: Boolean(cfAppId),
      hasSecretKey: Boolean(cfSecretKey),
      environment: cfEnv || "sandbox",
    },
    server: {
      buildId: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "local-dev",
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/payments/create-order
 * Unified payment order creation endpoint.
 * Dispatches to the active payment gateway (Razorpay or Cashfree) configured in .env.
 */
router.post("/payments/create-order", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  const customerId = req.scope?.customerId ?? user?.customerId;
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    req.body?.correlationId ||
    `cwp_cor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (!user || user.role !== "customer" || !customerId) {
    logger.warn(
      {
        stage: "CUSTOMER_AUTHENTICATED",
        stageStatus: "FAILED",
        correlationId,
        hasUser: Boolean(user),
        role: user?.role,
        hasCustomerId: Boolean(customerId),
      },
      "[PAYMENT_GATEWAY_ROUTE] Unauthorized order creation attempt",
    );
    return res.status(403).json({
      error: "FORBIDDEN",
      code: "FORBIDDEN",
      message: "Only authenticated customers can initiate payments",
      correlationId,
    });
  }

  const { invoiceId, returnUrl, forceGateway } = req.body || {};
  const idempotencyKey =
    (req.headers["x-idempotency-key"] as string) ||
    req.body?.idempotencyKey ||
    undefined;

  let parsedInvoiceId: number | undefined = undefined;
  if (invoiceId != null && invoiceId !== "") {
    const num = Number(invoiceId);
    if (!Number.isInteger(num)) {
      return res.status(400).json({
        error: "INVALID_INVOICE_ID",
        code: "INVALID_INVOICE_ID",
        message: "invoiceId must be a valid integer",
        correlationId,
      });
    }
    parsedInvoiceId = num;
  }

  try {
    const host = req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const origin = req.get("origin");
    let inferredBaseUrl = origin || (host ? `${proto}://${host}` : undefined);
    if (
      inferredBaseUrl &&
      inferredBaseUrl.startsWith("http://") &&
      !inferredBaseUrl.includes("localhost") &&
      !inferredBaseUrl.includes("127.0.0.1")
    ) {
      inferredBaseUrl = inferredBaseUrl.replace("http://", "https://");
    }

    const result = await createUnifiedPaymentOrder({
      customerId,
      invoiceId: parsedInvoiceId,
      returnUrl,
      baseUrl: inferredBaseUrl,
      idempotencyKey,
      forceGateway,
      correlationId,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    const status =
      err.statusCode ||
      (typeof err.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500);

    const errorCode = err.code || "ORDER_CREATION_FAILED";

    logger.error(
      {
        stage: err.stageName || "ORDER_CREATION_FAILED",
        stageStatus: "FAILED",
        correlationId,
        status,
        errorCode,
        errorCategory: err.source || "gateway",
        err: err.message,
        customerId,
      },
      "[PAYMENT_GATEWAY_ROUTE] Create order request failed",
    );

    let clientMessage = "Payment service is momentarily unavailable. Please try again shortly or contact support.";
    if (errorCode === "NO_OUTSTANDING_BALANCE" || errorCode === "NO_OUTSTANDING_DUES") {
      clientMessage = "No outstanding balance found to settle. Your account is fully settled.";
      return res.status(200).json({
        success: false,
        error: errorCode,
        code: errorCode,
        message: clientMessage,
        balanceDue: 0,
        correlationId,
      });
    } else if (errorCode === "CUSTOMER_NOT_FOUND") {
      clientMessage = "Customer profile could not be found.";
    }

    return res.status(status).json({
      success: false,
      error: errorCode,
      code: errorCode,
      message: clientMessage,
      correlationId,
    });
  }
});

/**
 * POST /api/payments/razorpay/record-failure
 * Stage 11: Persists client-reported checkout modal failure event into ledger audit.
 */
router.post("/payments/razorpay/record-failure", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  const customerId = req.scope?.customerId ?? user?.customerId;
  const { orderId, correlationId, error } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }

  logger.warn(
    {
      stage: "CHECKOUT_FAILURE_RECEIVED",
      stageStatus: "REPORTED_BY_CLIENT",
      correlationId: correlationId || "unknown",
      orderId,
      customerId,
      code: error?.code,
      description: error?.description,
      source: error?.source,
      step: error?.step,
      reason: error?.reason,
      paymentId: error?.metadata?.payment_id,
    },
    "[PAYMENT_GATEWAY_ROUTE] Stage 11: CHECKOUT_FAILURE_RECEIVED from client modal",
  );

  try {
    const result = await recordRazorpayCheckoutFailure({
      orderId,
      customerId,
      correlationId: correlationId || "unknown",
      error: error || {},
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    logger.warn({ err: err.message, orderId }, "[PAYMENT_GATEWAY_ROUTE] Failed to record checkout failure in DB");
    return res.status(200).json({ success: true, recorded: false });
  }
});

/**
 * POST /api/payments/razorpay/verify
 * Verifies Razorpay checkout completion tokens and atomically settles the ledger.
 */
router.post("/payments/razorpay/verify", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  const customerId = req.scope?.customerId ?? user?.customerId;
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    req.body?.correlationId ||
    `cwp_cor_${Date.now()}`;

  if (!user || user.role !== "customer" || !customerId) {
    return res.status(403).json({
      error: "FORBIDDEN",
      code: "FORBIDDEN",
      message: "Only authenticated customers can verify payments",
      correlationId,
    });
  }

  const { orderId, paymentId, signature } = req.body || {};

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      error: "MISSING_VERIFICATION_TOKENS",
      code: "MISSING_VERIFICATION_TOKENS",
      message: "orderId, paymentId, and signature are required for Razorpay verification",
      correlationId,
    });
  }

  try {
    const result = await verifyRazorpayPayment({
      orderId,
      paymentId,
      signature,
      customerId,
      correlationId,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    const status = err.statusCode || (typeof err.status === "number" ? err.status : 500);
    logger.error(
      { stageStatus: "FAILED", correlationId, err: err.message, code: err.code, orderId, paymentId, customerId },
      "[PAYMENT_GATEWAY_ROUTE] Razorpay verification failed",
    );

    return res.status(status).json({
      error: err.code || "VERIFICATION_FAILED",
      code: err.code || "VERIFICATION_FAILED",
      message: err.message || "Payment verification failed",
      correlationId,
    });
  }
});

/**
 * POST /api/payments/admin/diagnose-order-creation
 * Controlled admin diagnostic order creation tool (FINDING 8).
 * Tests live Razorpay Orders API connectivity, key validation, and response structure
 * WITHOUT performing a charge or mutating customer balance.
 */
router.post("/payments/admin/diagnose-order-creation", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || (user.role !== "admin" && user.role !== "superadmin" && user.role !== "central_admin")) {
    return res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
  }

  const { customerId = 20, invoiceId } = req.body || {};
  const correlationId = `cwp_diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  logger.info({ correlationId, customerId, invoiceId }, "[ADMIN_DIAGNOSTICS] Controlled order creation test started");

  try {
    const result = await createRazorpayPaymentOrder({
      customerId: Number(customerId),
      invoiceId: invoiceId ? Number(invoiceId) : undefined,
      correlationId,
    });

    return res.status(200).json({
      success: true,
      diagnosticStage: "CONTROLLED_ORDER_CREATION_PASSED",
      correlationId,
      order: {
        orderId: result.orderId,
        keyIdPrefix: result.keyId?.slice(0, 9),
        amountInPaise: result.amountInPaise,
        orderAmountRupees: result.orderAmount,
        currency: result.orderCurrency,
        environment: result.environment,
        customerName: result.customer.name,
      },
      message: "Order successfully created on Razorpay API. Live Key ID and Key Secret validated against Razorpay gateway.",
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      diagnosticStage: "CONTROLLED_ORDER_CREATION_FAILED",
      correlationId,
      error: {
        code: err.code || "DIAGNOSTIC_FAILED",
        message: err.message,
        stage: err.stageName,
        raw: err.rawBody,
      },
    });
  }
});

/**
 * Handle incoming Razorpay Webhook
 */
async function handleRazorpayWebhook(req: Request, res: Response) {
  const signature = (req.headers["x-razorpay-signature"] as string) || "";
  const eventId = (req.headers["x-razorpay-event-id"] as string) || undefined;
  const rawBody = (req as any).rawBody;

  if (!signature) {
    logger.warn("[RAZORPAY_WEBHOOK_ROUTE] Missing x-razorpay-signature header");
    return res.status(400).json({ error: "Missing signature header" });
  }

  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    logger.error("[RAZORPAY_WEBHOOK_ROUTE] Missing raw request body buffer for webhook signature verification");
    return res.status(400).json({
      error: "MISSING_RAW_BODY",
      message: "Raw request body buffer required for cryptographic webhook verification",
    });
  }

  try {
    const result = await handleRazorpayWebhookPayload(rawBody, signature, eventId);
    return res.status(200).json({ received: true, ...result });
  } catch (err: any) {
    const status = err.statusCode || 400;
    logger.warn({ err: err.message, status }, "[RAZORPAY_WEBHOOK_ROUTE] Webhook rejection");
    return res.status(status).json({ error: err.message || "Webhook processing failed" });
  }
}

router.get("/webhooks/razorpay", (_req: Request, res: Response) => {
  return res.status(200).json({
    status: "active",
    gateway: "razorpay",
    message: "Razorpay webhook endpoint is live and awaiting POST events from Razorpay.",
  });
});

router.post("/webhooks/razorpay", handleRazorpayWebhook);
router.post("/payments/razorpay/webhook", handleRazorpayWebhook);

export default router;
