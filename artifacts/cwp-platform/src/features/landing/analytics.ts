/**
 * Landing funnel events — same pattern as authAnalytics.
 * Wire `trackLandingEvent` to GA4 / Mixpanel later.
 */

export type LandingAnalyticsEvent =
  | "hero_division_selected"
  | "hero_cta_clicked"
  | "hero_selector_keyboard"
  | "nav_cta_clicked";

export type LandingEventPayload = {
  division?: "vehicle" | "solar";
  from?: "vehicle" | "solar";
  ctaId?: string;
  href?: string;
  method?: "click" | "keyboard";
  key?: string;
};

const listeners: Array<
  (event: LandingAnalyticsEvent, payload?: LandingEventPayload) => void
> = [];

export function onLandingEvent(
  listener: (event: LandingAnalyticsEvent, payload?: LandingEventPayload) => void,
): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function trackLandingEvent(
  event: LandingAnalyticsEvent,
  payload?: LandingEventPayload,
): void {
  if (import.meta.env.DEV) {
    console.debug("[landing-analytics]", event, payload ?? {});
  }
  for (const listener of listeners) {
    try {
      listener(event, payload);
    } catch {
      // analytics must never break UX
    }
  }
}
