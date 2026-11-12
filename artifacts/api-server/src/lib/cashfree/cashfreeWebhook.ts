import crypto from "node:crypto";
import { getCashfreeConfig } from "./cashfreeConfig";
import { logger } from "../logger";

export interface VerifySignatureParams {
  signature: string;
  timestamp: string;
  rawBody: string | Buffer;
  clientSecret: string;
}

/**
 * Computes Cashfree HMAC-SHA256 signature in Base64 according to official spec.
 * Formula: HMAC-SHA256(timestamp + rawBody, secretKey) -> Base64
 */
export function generateCashfreeSignature(
  timestamp: string,
  rawBody: string | Buffer,
  secretKey: string,
): string {
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(Buffer.from(timestamp, "utf8"));
  if (Buffer.isBuffer(rawBody)) {
    hmac.update(rawBody);
  } else {
    hmac.update(Buffer.from(rawBody, "utf8"));
  }
  return hmac.digest("base64");
}

/**
 * Validates incoming webhook signature using timingSafeEqual with length check.
 * Strictly prevents timing attacks and safely returns false without throwing RangeError on length mismatch.
 */
export function verifyCashfreeWebhookSignature(params: VerifySignatureParams): boolean {
  const { signature, timestamp, rawBody, clientSecret } = params;
  if (!signature || !timestamp || rawBody === undefined || rawBody === null || !clientSecret) {
    return false;
  }

  try {
    const expectedSignature = generateCashfreeSignature(timestamp, rawBody, clientSecret);
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expectedSignature, "utf8");

    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (err: any) {
    logger.warn({ err: err.message }, "[CASHFREE_WEBHOOK] Error during signature verification");
    return false;
  }
}

/**
 * Validates webhook timestamp freshness against drift thresholds.
 * Tolerates both second-based and millisecond-based timestamps.
 * Default max age: 300 seconds (5 minutes). Max future tolerance: 60 seconds.
 */
export function validateWebhookTimestamp(
  timestamp: string | number,
  maxDriftSeconds = 300,
): { valid: boolean; reason?: string } {
  let ts = typeof timestamp === "string" ? Number.parseInt(timestamp, 10) : timestamp;
  if (!ts || Number.isNaN(ts)) {
    return { valid: false, reason: "INVALID_TIMESTAMP" };
  }

  // If timestamp is in seconds (e.g., 10 digits < 1e11), convert to milliseconds
  if (ts < 100_000_000_000) {
    ts *= 1000;
  }

  const now = Date.now();
  const ageMs = now - ts;

  if (ageMs > maxDriftSeconds * 1000) {
    return { valid: false, reason: "WEBHOOK_TIMESTAMP_EXPIRED" };
  }

  if (ts - now > 60 * 1000) {
    return { valid: false, reason: "WEBHOOK_TIMESTAMP_IN_FUTURE" };
  }

  return { valid: true };
}
