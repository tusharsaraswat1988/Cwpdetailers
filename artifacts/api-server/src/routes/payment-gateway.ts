import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";
import { getActivePaymentGateway } from "../lib/razorpay/razorpayConfig";
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
  const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body), "utf8");

  if (!signature) {
    logger.warn("[RAZORPAY_WEBHOOK_ROUTE] Missing x-razorpay-signature header");
    return res.status(400).json({ error: "Missing signature header" });
  }

  try {
    const result = await handleRazorpayWebhookPayload(rawBody, signature);
    return res.status(200).json({ received: true, ...result });
  } catch (err: any) {
    const status = err.statusCode || 400;
    logger.warn({ err: err.message, status }, "[RAZORPAY_WEBHOOK_ROUTE] Webhook rejection");
    return res.status(status).json({ error: err.message || "Webhook processing failed" });
  }
}

router.post("/webhooks/razorpay", handleRazorpayWebhook);
router.post("/payments/razorpay/webhook", handleRazorpayWebhook);

export default router;
