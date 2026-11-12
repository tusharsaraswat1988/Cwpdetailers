import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  createCashfreePaymentOrder,
  verifyCashfreePaymentOrder,
  handleCashfreeWebhookPayload,
} from "../lib/cashfree/cashfreeService";
import {
  verifyCashfreeWebhookSignature,
  validateWebhookTimestamp,
} from "../lib/cashfree/cashfreeWebhook";
import { getCashfreeConfig } from "../lib/cashfree/cashfreeConfig";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/payments/cashfree/create-order
 * Creates a Cashfree hosted checkout order session.
 * Requires customer authentication. Never trusts client-provided amounts.
 */
router.post("/payments/cashfree/create-order", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  const customerId = req.scope?.customerId ?? user?.customerId;

  if (!user || user.role !== "customer" || !customerId) {
    return res.status(403).json({
      error: "FORBIDDEN",
      code: "FORBIDDEN",
      message: "Only authenticated customers can initiate payments",
    });
  }

  const { invoiceId, returnUrl } = req.body || {};
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

  let validatedReturnUrl: string = "/customer/payment/return?order_id={order_id}";
  if (returnUrl != null && returnUrl !== "") {
    if (typeof returnUrl === "string") {
      const trimmed = returnUrl.trim();
      let isReturnValid = false;
      if (
        trimmed.startsWith("/customer/payment/return") &&
        !trimmed.startsWith("//") &&
        trimmed.includes("{order_id}")
      ) {
        isReturnValid = true;
      } else {
        try {
          const parsed = new URL(trimmed);
          if (
            (parsed.pathname === "/customer/payment/return" || parsed.pathname === "/customer/payment/return/") &&
            trimmed.includes("{order_id}")
          ) {
            isReturnValid = true;
          }
        } catch {
          isReturnValid = false;
        }
      }

      if (isReturnValid) {
        validatedReturnUrl = trimmed;
      } else {
        logger.warn(
          { returnUrl, customerId },
          "[CASHFREE_ROUTE] Client passed non-canonical returnUrl; falling back safely to canonical /customer/payment/return?order_id={order_id}",
        );
      }
    }
  }

  try {
    const host = req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const origin = req.get("origin");
    let inferredBaseUrl = origin || (host ? `${proto}://${host}` : undefined);
    if (inferredBaseUrl && inferredBaseUrl.startsWith("http://") && !inferredBaseUrl.includes("localhost") && !inferredBaseUrl.includes("127.0.0.1")) {
      inferredBaseUrl = inferredBaseUrl.replace("http://", "https://");
    }

    const result = await createCashfreePaymentOrder({
      customerId,
      invoiceId: parsedInvoiceId,
      returnUrl: validatedReturnUrl,
      baseUrl: inferredBaseUrl,
      idempotencyKey,
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
      "[CASHFREE_ROUTE] Create order request rejected or failed",
    );

    // Provide clean, customer-safe message — never leak internal environment variables, credentials, or raw stack traces to the client
    let clientMessage = "Payment service is momentarily unavailable. Please try again shortly or contact support.";
    if (errorCode === "NO_OUTSTANDING_DUES") {
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
 * GET /api/payments/cashfree/verify/:orderId
 * Verifies payment status directly against Cashfree and returns settled status or receipt.
 * Requires authenticated customer and strictly respects tenant boundaries.
 */
router.get("/payments/cashfree/verify/:orderId", requireAuth, async (req: Request, res: Response) => {
  const user = req.user;
  const customerId = req.scope?.customerId ?? user?.customerId;

  if (!user || user.role !== "customer" || !customerId) {
    return res.status(403).json({
      error: "FORBIDDEN",
      code: "FORBIDDEN",
      message: "Only authenticated customers can verify payments",
    });
  }

  const { orderId } = req.params;
  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({
      error: "INVALID_ORDER_ID",
      code: "INVALID_ORDER_ID",
      message: "Valid orderId is required",
    });
  }

  try {
    const result = await verifyCashfreePaymentOrder(orderId, customerId);
    return res.status(200).json(result);
  } catch (err: any) {
    const status =
      err.statusCode ||
      (typeof err.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500);

    const errorCode = err.code || "PAYMENT_VERIFICATION_FAILED";

    logger.warn(
      { err: err.message, code: errorCode, status, orderId, customerId },
      "[CASHFREE_ROUTE] Return verification rejected or failed",
    );

    // Provide clean, customer-safe message — never leak internal environment variables, credentials, or raw stack traces to the client
    let clientMessage = "Payment service is momentarily unavailable. Please try again shortly or contact support.";
    if (errorCode === "NO_OUTSTANDING_DUES") {
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
 * Webhook handler logic shared across webhook routes
 */
async function handleWebhook(req: Request, res: Response) {
  const signature = (req.headers["x-webhook-signature"] as string) || "";
  const timestamp = (req.headers["x-webhook-timestamp"] as string) || "";
  const rawBody = (req as any).rawBody || req.body;

  if (!signature || !timestamp || rawBody === undefined || rawBody === null) {
    return res.status(400).json({
      error: "MISSING_SIGNATURE_HEADERS",
      code: "MISSING_SIGNATURE_HEADERS",
      message: "x-webhook-signature and x-webhook-timestamp headers are required",
    });
  }

  // 1. Validate timestamp drift
  const tsValidation = validateWebhookTimestamp(timestamp);
  if (!tsValidation.valid) {
    logger.warn(
      { reason: tsValidation.reason, timestamp },
      "[CASHFREE_ROUTE] Webhook rejected due to timestamp drift",
    );
    return res.status(400).json({
      error: tsValidation.reason || "INVALID_TIMESTAMP",
      code: tsValidation.reason || "INVALID_TIMESTAMP",
      message: "Webhook timestamp expired or in future",
    });
  }

  // 2. Validate HMAC-SHA256 signature
  const config = getCashfreeConfig();
  const secretKey = config.secretKey || process.env.CASHFREE_SECRET_KEY || "";

  const isValid = verifyCashfreeWebhookSignature({
    signature,
    timestamp,
    rawBody,
    clientSecret: secretKey,
  });

  if (!isValid) {
    logger.warn(
      { timestamp },
      "[CASHFREE_ROUTE] Webhook signature verification failed",
    );
    return res.status(400).json({
      error: "INVALID_SIGNATURE",
      code: "INVALID_SIGNATURE",
      message: "Webhook HMAC signature verification failed",
    });
  }

  // 3. Parse and process webhook payload
  try {
    let payload: any;
    if (typeof req.body === "object" && req.body !== null && Object.keys(req.body).length > 0) {
      payload = req.body;
    } else {
      const rawStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
      payload = JSON.parse(rawStr);
    }

    const result = await handleCashfreeWebhookPayload(payload);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error(
      { err: err.message },
      "[CASHFREE_ROUTE] Error processing webhook event",
    );
    return res.status(500).json({
      error: "WEBHOOK_PROCESSING_ERROR",
      message: err.message || "Failed to process webhook payload",
    });
  }
}

/**
 * Public Cashfree Webhook Ingestion API
 * POST /api/webhooks/cashfree
 */
router.post("/webhooks/cashfree", handleWebhook);

/**
 * Alternative Cashfree Webhook route
 * POST /api/payments/cashfree/webhook
 */
router.post("/payments/cashfree/webhook", handleWebhook);

export default router;
