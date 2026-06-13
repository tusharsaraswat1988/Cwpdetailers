import webpush from "web-push";
import { logger } from "../logger";

let configured = false;

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY
    && process.env.VAPID_PRIVATE_KEY
    && process.env.VAPID_SUBJECT,
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export function ensureWebPushConfigured(): boolean {
  if (configured) return true;
  if (!isWebPushConfigured()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: WebPushPayload,
): Promise<{ ok: true } | { ok: false; error: string; expired?: boolean }> {
  if (!ensureWebPushConfigured()) {
    return { ok: false, error: "Web Push not configured (VAPID keys missing)" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    const message = err instanceof Error ? err.message : "Push delivery failed";
    if (status === 404 || status === 410) {
      return { ok: false, error: message, expired: true };
    }
    logger.warn({ err, endpoint: subscription.endpoint.slice(0, 48) }, "Web push delivery failed");
    return { ok: false, error: message };
  }
}

/** Generate keys once: npx web-push generate-vapid-keys */
export function generateVapidKeysForSetup() {
  return webpush.generateVAPIDKeys();
}
