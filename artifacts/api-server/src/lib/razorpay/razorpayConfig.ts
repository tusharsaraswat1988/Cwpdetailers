export type RazorpayEnvironment = "sandbox" | "production";
export type PaymentGatewayType = "razorpay" | "cashfree";

export interface RazorpayServerConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  env: RazorpayEnvironment;
  baseUrl: string;
  timeoutMs: number;
}

export class RazorpayConfigError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RazorpayConfigError";
    this.code = code;
  }
}

/**
 * Strips whitespace and accidental surrounding quotes (common in cloud platform secret editors).
 */
export function cleanEnvVar(val?: string): string {
  if (!val) return "";
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Resolves active payment gateway from environment variable.
 * Priority:
 * 1. Explicit ACTIVE_PAYMENT_GATEWAY ("razorpay" or "cashfree")
 * 2. If RAZORPAY_KEY_ID is configured, default to "razorpay"
 * 3. Default fallback to "cashfree"
 */
export function getActivePaymentGateway(): PaymentGatewayType {
  const envVal = cleanEnvVar(process.env.ACTIVE_PAYMENT_GATEWAY).toLowerCase();
  if (envVal === "razorpay" || envVal === "cashfree") {
    return envVal;
  }
  const rzpKey = cleanEnvVar(process.env.RAZORPAY_KEY_ID);
  if (rzpKey) {
    return "razorpay";
  }
  return "cashfree";
}

/**
 * Resolves Razorpay environment based on key prefix.
 * Keys starting with "rzp_test_" are strictly sandbox/test.
 * Keys starting with "rzp_live_" are production.
 */
export function resolveRazorpayEnvironment(keyId: string): RazorpayEnvironment {
  if (keyId.startsWith("rzp_test_") || keyId.startsWith("TEST")) {
    return "sandbox";
  }
  return "production";
}

/**
 * Resolves Razorpay API Base URL.
 * Priority:
 * 1. RAZORPAY_BASE_URL environment variable (used by test mock harness)
 * 2. Default: https://api.razorpay.com/v1
 */
export function getRazorpayBaseUrl(): string {
  const override = cleanEnvVar(process.env.RAZORPAY_BASE_URL);
  if (override) {
    return override.replace(/\/+$/, "");
  }
  return "https://api.razorpay.com/v1";
}

/**
 * Validates and retrieves server-side Razorpay configuration.
 * Throws RazorpayConfigError if required credentials are missing.
 */
export function getRazorpayConfig(): RazorpayServerConfig {
  const keyId = cleanEnvVar(process.env.RAZORPAY_KEY_ID);
  const keySecret = cleanEnvVar(process.env.RAZORPAY_KEY_SECRET);
  const webhookSecret = cleanEnvVar(process.env.RAZORPAY_WEBHOOK_SECRET) || undefined;
  const rawTimeout = cleanEnvVar(process.env.RAZORPAY_TIMEOUT_MS);
  const timeoutMs = rawTimeout ? parseInt(rawTimeout, 10) : 15_000;

  if (!keyId) {
    throw new RazorpayConfigError(
      "Razorpay Key ID is missing. Set RAZORPAY_KEY_ID in environment.",
      "MISSING_RAZORPAY_KEY_ID",
    );
  }

  if (!keySecret) {
    throw new RazorpayConfigError(
      "Razorpay Key Secret is missing. Set RAZORPAY_KEY_SECRET in environment.",
      "MISSING_RAZORPAY_KEY_SECRET",
    );
  }

  const env = resolveRazorpayEnvironment(keyId);
  const baseUrl = getRazorpayBaseUrl();

  return {
    keyId,
    keySecret,
    webhookSecret,
    env,
    baseUrl,
    timeoutMs,
  };
}
