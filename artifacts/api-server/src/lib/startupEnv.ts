import { logger } from "./logger";

export interface SafeEnvSummary {
  nodeEnv: string;
  port: number;
  databaseConfigured: boolean;
  databaseHost: string;
  adminBootstrapConfigured: boolean;
  smsConfigured: boolean;
  smsSenderId: string;
  smsKeyMasked: string;
  googleAuthConfigured: boolean;
  googleClientIdMasked: string;
  webPushConfigured: boolean;
}

function maskSecret(secret?: string | null): string {
  if (!secret) return "not-set";
  const trimmed = secret.trim();
  if (trimmed.length <= 6) return "******";
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

function maskGoogleClientId(id?: string | null): string {
  if (!id) return "not-set";
  const trimmed = id.trim();
  const atIdx = trimmed.indexOf(".apps.googleusercontent.com");
  if (atIdx > 6) {
    return `${trimmed.slice(0, 4)}***${trimmed.slice(atIdx)}`;
  }
  return maskSecret(trimmed);
}

/**
 * Validates critical environment variables safely at startup.
 * Throws descriptive errors if fatal prerequisites are missing.
 * Logs safe, non-leaking diagnostic summaries for optional providers.
 */
export function validateStartupEnvironment(): SafeEnvSummary {
  // 1. Validate PORT (default to 8080 per project contract if omitted)
  const rawPort = process.env.PORT?.trim();
  let port = 8080;
  if (rawPort) {
    const parsed = Number(rawPort);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
      throw new Error(`[FATAL_STARTUP_CONFIG] Invalid PORT value: "${rawPort}". Must be 1-65535.`);
    }
    port = parsed;
  } else {
    logger.info("[STARTUP_CONFIG] PORT not specified, defaulting to 8080.");
  }

  // 2. Validate DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.trim()) {
    throw new Error(
      "[FATAL_STARTUP_CONFIG] DATABASE_URL environment variable is required for PostgreSQL connection.",
    );
  }
  if (!dbUrl.startsWith("postgres://") && !dbUrl.startsWith("postgresql://")) {
    throw new Error(
      "[FATAL_STARTUP_CONFIG] DATABASE_URL must start with postgres:// or postgresql://",
    );
  }
  const dbHost = dbUrl.split("@")[1]?.split("/")[0] ?? "unknown-host";

  // 3. Check Admin Bootstrap Configuration
  const adminPhone = process.env.ADMIN_PHONE?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminConfigured = Boolean(adminPhone && adminPassword);
  if (!adminConfigured) {
    logger.warn(
      "[STARTUP_CONFIG] ADMIN_PHONE or ADMIN_PASSWORD unset; automatic super admin bootstrap will be skipped.",
    );
  }

  // 4. Safe SMS provider check (Fast2SMS)
  const smsKey = process.env.FAST2SMS_API_KEY?.trim();
  const smsSenderId = process.env.FAST2SMS_SENDER_ID?.trim() || "CWPDTL";
  const smsConfigured = Boolean(smsKey && smsKey.length > 5);

  if (!smsConfigured) {
    logger.warn(
      "[STARTUP_CONFIG] FAST2SMS_API_KEY is unset or empty. SMS OTP delivery will run in mock/test mode.",
    );
  }

  // 5. Google Auth check
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleConfigured = Boolean(googleClientId && googleClientId.length > 10);

  // 6. Web Push check
  const vapidPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  const webPushConfigured = Boolean(vapidPublic && vapidPrivate);

  const summary: SafeEnvSummary = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port,
    databaseConfigured: true,
    databaseHost: dbHost,
    adminBootstrapConfigured: adminConfigured,
    smsConfigured,
    smsSenderId,
    smsKeyMasked: maskSecret(smsKey),
    googleAuthConfigured: googleConfigured,
    googleClientIdMasked: maskGoogleClientId(googleClientId),
    webPushConfigured,
  };

  logger.info(
    {
      port: summary.port,
      databaseHost: summary.databaseHost,
      smsConfigured: summary.smsConfigured,
      smsSenderId: summary.smsSenderId,
      googleAuthConfigured: summary.googleAuthConfigured,
      webPushConfigured: summary.webPushConfigured,
    },
    "[STARTUP] Environment validation succeeded",
  );

  return summary;
}
