import type { NotificationEventType } from "../dcms/notificationEvents";

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type Payload = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return v != null ? String(v) : fallback;
}

/** Map notification_events → browser push copy. WhatsApp channel can reuse same templates later. */
export function buildPushMessages(
  eventType: NotificationEventType,
  payload: Payload,
): PushMessage[] {
  const vehicle = str(payload.vehicleNumber, "your vehicle");

  switch (eventType) {
    case "vehicle_assigned":
      return [{
        title: "New vehicle assigned",
        body: `New vehicle assigned: ${vehicle}`,
        url: "/staff/daily-route",
        tag: `vehicle-assigned-${payload.subscriptionId ?? ""}`,
      }];

    case "route_updated":
      return [{
        title: "Route updated",
        body: "Your daily cleaning route order has been updated.",
        url: "/staff/daily-route",
        tag: "route-updated",
      }];

    case "daily_route_available":
      return [{
        title: "Today's route ready",
        body: `Daily route available — ${str(payload.stopCount, "0")} vehicles scheduled.`,
        url: "/staff/daily-route",
        tag: "daily-route",
      }];

    case "visit_rejected": {
      const reason = str(payload.reason, "Visit rejected");
      const isGps = reason.toLowerCase().includes("outside") || reason.toLowerCase().includes("service area");
      return [{
        title: "Visit rejected",
        body: isGps ? "Visit rejected. Outside service area." : reason,
        url: "/staff/daily-route",
        tag: `visit-rejected-${payload.visitId ?? ""}`,
      }];
    }

    case "subscription_paused":
      return [{
        title: "Subscription paused",
        body: payload.audience === "staff"
          ? `Subscription paused for ${vehicle}.`
          : `Your daily cleaning plan for ${vehicle} is paused.`,
        url: payload.audience === "staff" ? "/staff/daily-route" : "/customer/daily-cleaning",
        tag: `paused-${payload.subscriptionId ?? ""}`,
      }];

    case "visit_completed": {
      const visitType = str(payload.visitType, "cleaning");
      const isWash = visitType === "wash";
      const remainingWashes = payload.remainingWashes;
      const messages: PushMessage[] = [{
        title: isWash ? "Wash completed" : "Cleaning completed",
        body: isWash
          ? `Your vehicle ${vehicle} wash was completed successfully.`
          : `Your vehicle ${vehicle} was cleaned successfully.`,
        url: "/customer/daily-cleaning",
        tag: `visit-${payload.visitId ?? ""}`,
      }];

      if (!isWash) {
        messages.push({
          title: "How was today's cleaning?",
          body: `Please share feedback for ${vehicle}.`,
          url: "/customer/daily-cleaning",
          tag: `feedback-${payload.visitId ?? ""}`,
        });
      }

      if (isWash && remainingWashes != null) {
        messages.push({
          title: "Wash balance update",
          body: `${remainingWashes} wash${Number(remainingWashes) === 1 ? "" : "es"} remaining in your plan.`,
          url: "/customer/daily-cleaning",
          tag: `washes-${payload.subscriptionId ?? ""}`,
        });
      }

      return messages;
    }

    case "feedback_requested":
      return [{
        title: "Feedback requested",
        body: `How was today's cleaning for ${vehicle}?`,
        url: "/customer/daily-cleaning",
        tag: `feedback-${payload.visitId ?? ""}`,
      }];

    case "renewal_eligible":
      return [{
        title: "Plan renewal",
        body: `Your plan for ${vehicle} is ready for renewal.`,
        url: "/customer/daily-cleaning",
        tag: `renewal-${payload.subscriptionId ?? ""}`,
      }];

    case "missed_visit":
      return [{
        title: "Missed cleaning",
        body: `A scheduled cleaning for ${vehicle} was missed.`,
        url: "/admin/daily-cleaning",
        tag: `missed-${payload.subscriptionId ?? ""}`,
      }];

    case "high_missed_visits":
      return [{
        title: "High missed visit count",
        body: `${str(payload.count, "Several")} missed visits recorded today. Review operations.`,
        url: "/admin/daily-cleaning",
        tag: "high-missed",
      }];

    case "fraud_alert":
      return [{
        title: "Staff fraud alert",
        body: str(payload.message, "Suspicious visit activity detected."),
        url: "/admin/daily-cleaning/visits",
        tag: `fraud-${payload.staffId ?? ""}`,
      }];

    case "negative_feedback":
      return [{
        title: "Negative customer feedback",
        body: `Customer reported issues with ${vehicle}. Review visit #${payload.visitId ?? ""}.`,
        url: "/admin/daily-cleaning",
        tag: `feedback-neg-${payload.visitId ?? ""}`,
      }];

    case "renewal_opportunity":
      return [{
        title: "Renewal opportunity",
        body: `${vehicle} — customer eligible for plan renewal.`,
        url: "/admin/daily-cleaning/subscriptions",
        tag: `renewal-ops-${payload.subscriptionId ?? ""}`,
      }];

    case "subscription_resumed":
      return [{
        title: "Subscription resumed",
        body: payload.audience === "staff"
          ? `Cleaning resumed for ${vehicle}.`
          : `Daily cleaning for ${vehicle} has resumed.`,
        url: payload.audience === "staff" ? "/staff/daily-route" : "/customer/daily-cleaning",
        tag: `resumed-${payload.subscriptionId ?? ""}`,
      }];

    default:
      return [];
  }
}

/** Human-readable reason for admin push delivery logs. */
export function describePushEventReason(
  eventType: NotificationEventType,
  payload: Payload,
): string {
  const vehicle = str(payload.vehicleNumber, "vehicle");
  switch (eventType) {
    case "vehicle_assigned":
      return `New daily-cleaning assignment for ${vehicle}`;
    case "route_updated":
      return "Staff route order was changed by admin";
    case "daily_route_available":
      return `Morning route published (${str(payload.stopCount, "?")} stops)`;
    case "visit_rejected":
      return str(payload.reason, "Visit was rejected during completion");
    case "visit_completed":
      return payload.visitType === "wash"
        ? `Wash visit completed for ${vehicle}`
        : `Cleaning visit completed for ${vehicle}`;
    case "feedback_requested":
      return `Customer feedback requested after cleaning (${vehicle})`;
    case "subscription_paused":
      return payload.audience === "staff"
        ? `Subscription paused — staff alert (${vehicle})`
        : `Subscription paused for ${vehicle}`;
    case "subscription_resumed":
      return payload.audience === "staff"
        ? `Subscription resumed — staff alert (${vehicle})`
        : `Subscription resumed for ${vehicle}`;
    case "renewal_eligible":
      return `Customer plan exhausted / renewal eligible (${vehicle})`;
    case "renewal_opportunity":
      return `Admin renewal opportunity (${vehicle})`;
    case "missed_visit":
      return `Missed cleaning recorded for ${vehicle} on ${str(payload.visitDate, "schedule date")}`;
    case "high_missed_visits":
      return `End-of-day missed visit threshold reached (${str(payload.count, "multiple")} missed)`;
    case "fraud_alert":
      return str(payload.message, "Suspicious staff visit activity");
    case "negative_feedback":
      return `Customer gave negative feedback for visit #${str(payload.visitId, "?")} (${vehicle})`;
    default:
      return `System event: ${eventType}`;
  }
}
