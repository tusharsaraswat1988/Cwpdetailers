import { createHmac, timingSafeEqual } from "node:crypto";
import { getRazorpayConfig } from "./razorpayConfig";
import { logger } from "../logger";

export interface VerifyWebhookOptions {
  secret?: string;
}

/**
 * Validates Razorpay Webhook signature using HMAC-SHA256 and constant-time comparison.
 * Requires the exact raw Buffer or raw string of the HTTP request body.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  options?: VerifyWebhookOptions,
): boolean {
  try {
    const secret = options?.secret || getRazorpayConfig().webhookSecret;
    if (!secret) {
      logger.error("[RAZORPAY_WEBHOOK] Cannot verify webhook signature: Webhook Secret is not configured");
      return false;
    }

    if (!signature) {
      logger.warn("[RAZORPAY_WEBHOOK] Missing X-Razorpay-Signature header");
      return false;
    }

    const payload = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
    const computedSignature = createHmac("sha256", secret).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature, "utf8");
    const compBuf = Buffer.from(computedSignature, "utf8");

    if (sigBuf.length !== compBuf.length) {
      return false;
    }

    return timingSafeEqual(sigBuf, compBuf);
  } catch (err: any) {
    logger.error({ err: err.message }, "[RAZORPAY_WEBHOOK] Webhook signature verification error");
    return false;
  }
}

/**
 * Validates Razorpay client-side payment completion signature.
 * Expected signature is HMAC-SHA256 of `${order_id}|${payment_id}` using Key Secret.
 */
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secretOverride?: string,
): boolean {
  try {
    const secret = secretOverride || getRazorpayConfig().keySecret;
    if (!secret) {
      logger.error("[RAZORPAY_SIGNATURE] Missing Key Secret for payment verification");
      return false;
    }

    if (!orderId || !paymentId || !signature) {
      return false;
    }

    const payload = `${orderId}|${paymentId}`;
    const computedSignature = createHmac("sha256", secret).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature, "utf8");
    const compBuf = Buffer.from(computedSignature, "utf8");

    if (sigBuf.length !== compBuf.length) {
      return false;
    }

    return timingSafeEqual(sigBuf, compBuf);
  } catch (err: any) {
    logger.error({ err: err.message }, "[RAZORPAY_SIGNATURE] Payment signature verification error");
    return false;
  }
}
