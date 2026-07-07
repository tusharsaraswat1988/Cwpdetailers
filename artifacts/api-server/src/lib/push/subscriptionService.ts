import {
  db,
  pushSubscriptionsTable,
  pushNotificationsTable,
  usersTable,
  customersTable,
  staffTable,
  type PushSubscriptionKeys,
} from "@workspace/db";
import { eq, and, desc, ne } from "drizzle-orm";
import { sendWebPush, type WebPushPayload } from "./webPushService";

export async function registerPushSubscription(input: {
  userId: number;
  role: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string | null;
}) {
  const now = new Date();
  const [row] = await db.insert(pushSubscriptionsTable).values({
    userId: input.userId,
    role: input.role,
    endpoint: input.endpoint,
    keys: input.keys,
    userAgent: input.userAgent ?? null,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: pushSubscriptionsTable.endpoint,
    set: {
      userId: input.userId,
      role: input.role,
      keys: input.keys,
      userAgent: input.userAgent ?? null,
      updatedAt: now,
    },
  }).returning();

  // Drop stale device tokens (e.g. after VAPID key rotation) — keep only this endpoint.
  await db.delete(pushSubscriptionsTable).where(and(
    eq(pushSubscriptionsTable.userId, input.userId),
    ne(pushSubscriptionsTable.endpoint, input.endpoint),
  ));

  return row!;
}

export async function unregisterPushSubscription(userId: number, endpoint: string) {
  await db.delete(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.userId, userId),
      eq(pushSubscriptionsTable.endpoint, endpoint),
    ));
}

export async function listUserPushSubscriptions(userId: number) {
  return db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
}

export async function getPushStatus(userId: number) {
  const subs = await listUserPushSubscriptions(userId);
  const [last] = await db.select().from(pushNotificationsTable)
    .where(and(eq(pushNotificationsTable.userId, userId), eq(pushNotificationsTable.status, "sent")))
    .orderBy(desc(pushNotificationsTable.sentAt))
    .limit(1);

  return {
    subscribed: subs.length > 0,
    subscriptionCount: subs.length,
    lastNotification: last ? {
      title: last.title,
      body: last.body,
      receivedAt: last.sentAt?.toISOString() ?? last.createdAt.toISOString(),
    } : null,
  };
}

export async function deliverPushToUser(input: {
  userId: number;
  notificationEventId?: number | null;
  message: WebPushPayload;
  payload?: Record<string, unknown>;
  eventType?: string | null;
  reason?: string | null;
  recipientRole?: string | null;
  recipientName?: string | null;
}) {
  const [user] = await db.select({
    name: usersTable.name,
    role: usersTable.role,
  }).from(usersTable).where(eq(usersTable.id, input.userId)).limit(1);

  const recipientName = input.recipientName ?? user?.name ?? null;
  const recipientRole = input.recipientRole ?? user?.role ?? null;

  const logBase = {
    userId: input.userId,
    notificationEventId: input.notificationEventId ?? null,
    title: input.message.title,
    body: input.message.body,
    payload: { ...input.payload, url: input.message.url, tag: input.message.tag },
    channel: "web_push" as const,
    eventType: input.eventType ?? null,
    reason: input.reason ?? null,
    recipientRole,
    recipientName,
  };

  const subs = await listUserPushSubscriptions(input.userId);
  if (!subs.length) {
    await db.insert(pushNotificationsTable).values({
      ...logBase,
      status: "skipped",
      error: "No push subscription registered for user",
      sentAt: new Date(),
    });
    return { sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    const [record] = await db.insert(pushNotificationsTable).values({
      ...logBase,
      status: "pending",
    }).returning();

    const result = await sendWebPush(
      { endpoint: sub.endpoint, keys: sub.keys },
      input.message,
    );

    if (result.ok) {
      sent++;
      await db.update(pushNotificationsTable)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(pushNotificationsTable.id, record!.id));
    } else {
      failed++;
      await db.update(pushNotificationsTable)
        .set({ status: "failed", error: result.error, sentAt: new Date() })
        .where(eq(pushNotificationsTable.id, record!.id));
      if (result.expired) {
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
      }
    }
  }

  return { sent, failed, skipped: false };
}

export async function resolveUserIdFromCustomerId(customerId: number): Promise<number | null> {
  const [row] = await db.select({ userId: customersTable.userId }).from(customersTable)
    .where(eq(customersTable.id, customerId)).limit(1);
  return row?.userId ?? null;
}

export async function resolveUserIdFromStaffId(staffId: number): Promise<number | null> {
  const [staff] = await db.select({ userId: staffTable.userId }).from(staffTable)
    .where(eq(staffTable.id, staffId)).limit(1);
  if (staff?.userId) return staff.userId;

  const [user] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.staffId, staffId)).limit(1);
  return user?.id ?? null;
}

export async function listActiveAdminUserIds(): Promise<number[]> {
  const { or } = await import("drizzle-orm");
  const rows = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(
      eq(usersTable.isActive, true),
      or(
        eq(usersTable.role, "admin"),
        eq(usersTable.role, "superadmin"),
        eq(usersTable.role, "manager"),
      ),
    ));
  return rows.map(r => r.id);
}
