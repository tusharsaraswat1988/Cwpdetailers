import crypto from "node:crypto";

export interface WebhookHeaderOptions {
  timestamp?: string | number;
  tamperSignature?: boolean;
  tamperTimestamp?: boolean; // drifts by > 10 minutes in past
  futureTimestamp?: boolean; // drifts by > 5 minutes in future
  invalidSecret?: string;
  customTimestamp?: string | number;
}

/**
 * Computes Cashfree HMAC-SHA256 signature in Base64 according to official spec.
 * Formula: HMAC-SHA256(timestamp + rawBody, secretKey) -> Base64
 */
export function generateCashfreeSignature(
  timestamp: string,
  rawBody: string,
  secretKey: string
): string {
  const signedPayload = `${timestamp}${rawBody}`;
  return crypto
    .createHmac("sha256", secretKey)
    .update(signedPayload)
    .digest("base64");
}

/**
 * Generates full HTTP headers for a mock Cashfree webhook.
 */
export function generateCashfreeWebhookHeaders(
  payload: string | object,
  secretKey: string,
  options?: WebhookHeaderOptions
): {
  "x-webhook-timestamp": string;
  "x-webhook-signature": string;
  "content-type": string;
  rawBody: string;
} {
  const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);

  let timestamp: string;
  if (options?.tamperTimestamp) {
    // 10 minutes ago to trigger drift rejection (>300s)
    timestamp = (Date.now() - 600_000).toString();
  } else if (options?.futureTimestamp) {
    // 5 minutes in the future (>60s)
    timestamp = (Date.now() + 300_000).toString();
  } else if (options?.customTimestamp !== undefined) {
    timestamp = String(options.customTimestamp);
  } else if (options?.timestamp !== undefined) {
    timestamp = String(options.timestamp);
  } else {
    timestamp = Date.now().toString();
  }

  const effectiveSecret = options?.invalidSecret ?? secretKey;
  let signature = generateCashfreeSignature(timestamp, rawBody, effectiveSecret);

  if (options?.tamperSignature) {
    // Flip characters or mutate base64 string
    signature = signature.slice(0, -6) + "TAMPER";
  }

  return {
    "x-webhook-timestamp": timestamp,
    "x-webhook-signature": signature,
    "content-type": "application/json",
    rawBody,
  };
}

/**
 * Validates incoming webhook signature using timingSafeEqual with length safety check.
 * Prevents timing attacks and safely returns false without throwing RangeError on length mismatch.
 */
export function verifyCashfreeWebhookSignature(params: {
  signature: string;
  timestamp: string;
  rawBody: string;
  clientSecret: string;
}): boolean {
  const { signature, timestamp, rawBody, clientSecret } = params;
  if (!signature || !timestamp || !rawBody || !clientSecret) return false;

  const expectedSignature = generateCashfreeSignature(timestamp, rawBody, clientSecret);
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSignature, "utf8");

  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Validates webhook timestamp freshness against drift thresholds.
 * Default max age: 300 seconds (5 minutes). Max future tolerance: 60 seconds.
 */
export function validateWebhookTimestamp(
  timestamp: string | number,
  maxDriftSeconds = 300
): { valid: boolean; reason?: string } {
  const ts = typeof timestamp === "string" ? Number.parseInt(timestamp, 10) : timestamp;
  if (!ts || Number.isNaN(ts)) {
    return { valid: false, reason: "INVALID_TIMESTAMP" };
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
