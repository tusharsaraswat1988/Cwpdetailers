import {
  db,
  notificationEventsTable,
  notificationEventLogsTable,
} from "@workspace/db";

export type NotificationEventType =
  | "visit_completed"
  | "visit_rejected"
  | "subscription_paused"
  | "subscription_resumed"
  | "renewal_eligible"
  | "missed_visit"
  | "vehicle_assigned"
  | "route_updated"
  | "daily_route_available"
  | "feedback_requested"
  | "fraud_alert"
  | "negative_feedback"
  | "renewal_opportunity"
  | "high_missed_visits";

export async function emitNotificationEvent(input: {
  eventType: NotificationEventType;
  entityType: string;
  entityId: number;
  payload: Record<string, unknown>;
}) {
  const [event] = await db.insert(notificationEventsTable).values({
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
  }).returning();

  await db.insert(notificationEventLogsTable).values({
    eventId: event!.id,
    action: "created",
    metadata: { source: "dcms" },
  });

  const { queueNotificationEventPush } = await import("../push/eventProcessor");
  queueNotificationEventPush(event!);

  return event!;
}

export async function listNotificationEvents(filters?: {
  eventType?: NotificationEventType;
  unprocessedOnly?: boolean;
  limit?: number;
}) {
  const { eq, isNull, and, desc } = await import("drizzle-orm");
  const conditions = [];
  if (filters?.eventType) conditions.push(eq(notificationEventsTable.eventType, filters.eventType));
  if (filters?.unprocessedOnly) conditions.push(isNull(notificationEventsTable.processedAt));

  return db.select().from(notificationEventsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(notificationEventsTable.createdAt))
    .limit(filters?.limit ?? 100);
}
