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
 * Resolves Cashfree Gateway Base URL.
 * Priority:
 * 1. CASHFREE_BASE_URL environment variable (used by mock test harness)
 * 2. Production URL: https://api.cashfree.com/pg
 * 3. Sandbox URL: https://sandbox.cashfree.com/pg
 */
export function getCashfreeBaseUrl(env: CashfreeEnvironment = "sandbox"): string {
  const override = process.env.CASHFREE_BASE_URL?.trim();
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
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim();
  const rawEnv = (process.env.CASHFREE_ENV?.trim().toLowerCase() || "sandbox");
  const env: CashfreeEnvironment = rawEnv === "production" ? "production" : "sandbox";
  const apiVersion = process.env.CASHFREE_API_VERSION?.trim() || "2023-08-01";
  const rawTimeout = process.env.CASHFREE_TIMEOUT_MS?.trim();
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
  const rawEnv = (process.env.CASHFREE_ENV?.trim().toLowerCase() || "sandbox");
  const env: CashfreeEnvironment = rawEnv === "production" ? "production" : "sandbox";
  return {
    appId: process.env.CASHFREE_APP_ID?.trim() || "",
    env,
    apiVersion: process.env.CASHFREE_API_VERSION?.trim() || "2023-08-01",
  };
}

/**
 * Checks whether Cashfree credentials are configured.
 */
export function isCashfreeConfigured(): boolean {
  return Boolean(process.env.CASHFREE_APP_ID?.trim() && process.env.CASHFREE_SECRET_KEY?.trim());
}
