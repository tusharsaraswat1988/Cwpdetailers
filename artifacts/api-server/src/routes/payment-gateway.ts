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

  if (!user || user.role !== "customer" || !customerId) {
    return res.status(403).json({
      error: "FORBIDDEN",
      code: "FORBIDDEN",
      message: "Only authenticated customers can initiate payments",
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
    });

    return res.status(200).json(result);
  } catch (err: any) {
    const status =
      err.statusCode ||
      (typeof err.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500);

    const errorCode = err.code || "ORDER_CREATION_FAILED";

    logger.warn(
      { err: err.message, code: errorCode, status, customerId },
      "[PAYMENT_GATEWAY_ROUTE] Create order request failed",
    );

    let clientMessage = "Payment service is momentarily unavailable. Please try again shortly or contact support.";
    if (errorCode === "NO_OUTSTANDING_BALANCE" || errorCode === "NO_OUTSTANDING_DUES") {
      clientMessage = "No outstanding dues found to settle.";
    } else if (errorCode === "CUSTOMER_NOT_FOUND") {
      clientMessage = "Customer profile could not be found.";
    }

    return res.status(status).json({
      error: errorCode,
      code: errorCode,
      message: clientMessage,
    });
  }
});

/**
 * POST /api/payments/razorpay/verify
 * Verifies Razorpay checkout completion tokens and atomically settles the ledger.
 */
router.post("/payments/razorpay/verify", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  const customerId = req.scope?.customerId ?? user?.customerId;

  if (!user || user.role !== "customer" || !customerId) {
    return res.status(403).json({
      error: "FORBIDDEN",
      code: "FORBIDDEN",
      message: "Only authenticated customers can verify payments",
    });
  }

  const { orderId, paymentId, signature } = req.body || {};

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      error: "MISSING_VERIFICATION_TOKENS",
      code: "MISSING_VERIFICATION_TOKENS",
      message: "orderId, paymentId, and signature are required for Razorpay verification",
    });
  }

  try {
    const result = await verifyRazorpayPayment({
      orderId,
      paymentId,
      signature,
      customerId,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    const status = err.statusCode || (typeof err.status === "number" ? err.status : 500);
    logger.error(
      { err: err.message, code: err.code, orderId, paymentId, customerId },
      "[PAYMENT_GATEWAY_ROUTE] Razorpay verification failed",
    );

    return res.status(status).json({
      error: err.code || "VERIFICATION_FAILED",
      code: err.code || "VERIFICATION_FAILED",
      message: err.message || "Payment verification failed",
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
