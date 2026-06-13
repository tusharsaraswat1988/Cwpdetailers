import {
  db,
  notificationEventsTable,
  type NotificationEvent,
} from "@workspace/db";
import { eq, isNull, asc } from "drizzle-orm";
import { logger } from "../logger";
import type { NotificationEventType } from "../dcms/notificationEvents";
import { buildPushMessages, describePushEventReason } from "./templates";
import {
  deliverPushToUser,
  resolveUserIdFromCustomerId,
  resolveUserIdFromStaffId,
  listActiveAdminUserIds,
} from "./subscriptionService";

type Target = { userId: number; audience?: string };

async function resolveTargets(
  eventType: NotificationEventType,
  payload: Record<string, unknown>,
): Promise<Target[]> {
  const targets: Target[] = [];

  const customerId = payload.customerId != null ? Number(payload.customerId) : null;
  const staffId = payload.staffId != null ? Number(payload.staffId) : null;

  const customerEvents: NotificationEventType[] = [
    "visit_completed", "feedback_requested", "subscription_paused",
    "subscription_resumed", "renewal_eligible",
  ];
  const staffEvents: NotificationEventType[] = [
    "vehicle_assigned", "route_updated", "daily_route_available",
    "visit_rejected", "subscription_paused", "subscription_resumed",
  ];
  const adminEvents: NotificationEventType[] = [
    "missed_visit", "high_missed_visits", "fraud_alert",
    "negative_feedback", "renewal_opportunity",
  ];

  if (customerEvents.includes(eventType) && customerId) {
    const userId = await resolveUserIdFromCustomerId(customerId);
    if (userId) targets.push({ userId });
  }

  if (staffEvents.includes(eventType) && staffId) {
    const userId = await resolveUserIdFromStaffId(staffId);
    if (userId) targets.push({ userId, audience: "staff" });
  }

  if (adminEvents.includes(eventType)) {
    const adminIds = await listActiveAdminUserIds();
    for (const userId of adminIds) {
      targets.push({ userId, audience: "admin" });
    }
  }

  if (eventType === "visit_rejected" && payload.reason === "Outside Service Area") {
    const adminIds = await listActiveAdminUserIds();
    for (const userId of adminIds) {
      if (!targets.some(t => t.userId === userId)) {
        targets.push({ userId, audience: "admin" });
      }
    }
  }

  return dedupeTargets(targets);
}

function dedupeTargets(targets: Target[]): Target[] {
  const seen = new Set<number>();
  return targets.filter(t => {
    if (seen.has(t.userId)) return false;
    seen.add(t.userId);
    return true;
  });
}

export async function processNotificationEventPush(event: NotificationEvent) {
  const eventType = event.eventType as NotificationEventType;
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const targets = await resolveTargets(eventType, payload);
  if (!targets.length) return { delivered: 0 };

  let delivered = 0;
  const reason = describePushEventReason(eventType, payload);

  for (const target of targets) {
    const enrichedPayload = target.audience
      ? { ...payload, audience: target.audience }
      : payload;

    for (const message of buildPushMessages(eventType, enrichedPayload)) {
      const result = await deliverPushToUser({
        userId: target.userId,
        notificationEventId: event.id,
        message,
        payload: enrichedPayload,
        eventType,
        reason,
        recipientRole: target.audience ?? null,
      });
      if (result.sent > 0) delivered += result.sent;
    }
  }

  return { delivered };
}

export async function processPendingNotificationEvents(limit = 50) {
  const pending = await db.select().from(notificationEventsTable)
    .where(isNull(notificationEventsTable.processedAt))
    .orderBy(asc(notificationEventsTable.createdAt))
    .limit(limit);

  let processed = 0;
  for (const event of pending) {
    try {
      await processNotificationEventPush(event);
      await db.update(notificationEventsTable)
        .set({ processedAt: new Date() })
        .where(eq(notificationEventsTable.id, event.id));
      processed++;
    } catch (err) {
      logger.error({ err, eventId: event.id }, "Push event processing failed");
    }
  }
  return { processed, pending: pending.length };
}

/** Fire-and-forget push delivery for a freshly emitted event. */
export function queueNotificationEventPush(event: NotificationEvent) {
  processNotificationEventPush(event)
    .then(async () => {
      await db.update(notificationEventsTable)
        .set({ processedAt: new Date() })
        .where(eq(notificationEventsTable.id, event.id));
    })
    .catch(err => {
      logger.error({ err, eventId: event.id }, "Async push processing failed");
    });
}
