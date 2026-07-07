/**
 * Lightweight auth funnel events for future analytics integration.
 * Wire `trackAuthEvent` to your analytics provider (GA4, Mixpanel, etc.).
 */

export type AuthAnalyticsEvent =
  | "registration_started"
  | "otp_sent"
  | "otp_verified"
  | "registration_completed"
  | "login_completed"
  | "google_started"
  | "google_success"
  | "google_cancelled"
  | "password_login"
  | "forgot_password_started"
  | "forgot_password_completed";

type AuthEventPayload = {
  method?: "otp" | "password" | "google";
  portal?: string;
};

const listeners: Array<(event: AuthAnalyticsEvent, payload?: AuthEventPayload) => void> = [];

export function onAuthEvent(
  listener: (event: AuthAnalyticsEvent, payload?: AuthEventPayload) => void,
): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function trackAuthEvent(event: AuthAnalyticsEvent, payload?: AuthEventPayload): void {
  if (import.meta.env.DEV) {
    console.debug("[auth-analytics]", event, payload ?? {});
  }
  for (const listener of listeners) {
    try {
      listener(event, payload);
    } catch {
      // analytics must never break auth
    }
  }
}
