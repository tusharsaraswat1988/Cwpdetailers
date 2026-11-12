export type CashfreeEnvironment = "sandbox" | "production";

export interface CashfreeServerConfig {
  appId: string;
  secretKey: string;
  env: CashfreeEnvironment;
  apiVersion: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface CashfreeClientSafeConfig {
  appId: string;
  env: CashfreeEnvironment;
  apiVersion: string;
}

export class CashfreeConfigError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CashfreeConfigError";
    this.code = code;
  }
}

/**
 * Strips whitespace and accidental surrounding quotes (common in Railway/Docker env setups).
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
 * Resolves Cashfree environment (sandbox vs production) with auto-guard against credential mismatch.
 * Cashfree sandbox credentials strictly start with "TEST" or "cfsk_ma_test_".
 * If test credentials are provided on a server with CASHFREE_ENV=production, Cashfree production API
 * unconditionally fails with HTTP 401 "authentication Failed". We auto-fallback to sandbox to ensure continuity.
 */
export function resolveCashfreeEnvironment(
  appId: string,
  secretKey: string,
  rawEnv?: string,
): CashfreeEnvironment {
  const configured = rawEnv?.trim().toLowerCase();
  const isExplicitTestKey =
    appId.startsWith("TEST") ||
    secretKey.startsWith("cfsk_ma_test_");

  if (isExplicitTestKey) {
    return "sandbox";
  }

  const isExplicitProdKey = secretKey.startsWith("cfsk_ma_prod_");
  if (isExplicitProdKey) {
    return "production";
  }

  return configured === "production" ? "production" : "sandbox";
}

/**
 * Resolves Cashfree Gateway Base URL.
 * Priority:
 * 1. CASHFREE_BASE_URL environment variable (used by mock test harness)
 * 2. Production URL: https://api.cashfree.com/pg
 * 3. Sandbox URL: https://sandbox.cashfree.com/pg
 */
export function getCashfreeBaseUrl(env: CashfreeEnvironment = "sandbox"): string {
  const override = cleanEnvVar(process.env.CASHFREE_BASE_URL);
  if (override) {
    return override.replace(/\/+$/, "");
  }
  return env === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

/**
 * Validates and retrieves server-side Cashfree configuration.
 * Throws CashfreeConfigError if required credentials are missing.
 */
export function getCashfreeConfig(): CashfreeServerConfig {
  const appId = cleanEnvVar(process.env.CASHFREE_APP_ID);
  const secretKey = cleanEnvVar(process.env.CASHFREE_SECRET_KEY);
  const rawEnv = cleanEnvVar(process.env.CASHFREE_ENV);
  const apiVersion = cleanEnvVar(process.env.CASHFREE_API_VERSION) || "2023-08-01";
  const rawTimeout = cleanEnvVar(process.env.CASHFREE_TIMEOUT_MS);
  const timeoutMs = rawTimeout ? parseInt(rawTimeout, 10) : 15_000;

  if (!appId) {
    throw new CashfreeConfigError(
      "Cashfree App ID is missing. Set CASHFREE_APP_ID in environment.",
      "MISSING_CASHFREE_APP_ID",
    );
  }

  if (!secretKey) {
    throw new CashfreeConfigError(
      "Cashfree Secret Key is missing. Set CASHFREE_SECRET_KEY in environment.",
      "MISSING_CASHFREE_SECRET_KEY",
    );
  }

  const env: CashfreeEnvironment = resolveCashfreeEnvironment(appId, secretKey, rawEnv);
  const baseUrl = getCashfreeBaseUrl(env);

  return {
    appId,
    secretKey,
    env,
    apiVersion,
    baseUrl,
    timeoutMs,
  };
}

/**
 * Returns safe configuration for client consumption.
 * Strictly excludes private secretKey to prevent exposure.
 */
export function getClientSafeConfig(): CashfreeClientSafeConfig {
  const appId = cleanEnvVar(process.env.CASHFREE_APP_ID);
  const secretKey = cleanEnvVar(process.env.CASHFREE_SECRET_KEY);
  const rawEnv = cleanEnvVar(process.env.CASHFREE_ENV);
  const env: CashfreeEnvironment = resolveCashfreeEnvironment(appId, secretKey, rawEnv);

  return {
    appId,
    env,
    apiVersion: cleanEnvVar(process.env.CASHFREE_API_VERSION) || "2023-08-01",
  };
}

/**
 * Checks whether Cashfree credentials are configured.
 */
export function isCashfreeConfigured(): boolean {
  return Boolean(cleanEnvVar(process.env.CASHFREE_APP_ID) && cleanEnvVar(process.env.CASHFREE_SECRET_KEY));
}
