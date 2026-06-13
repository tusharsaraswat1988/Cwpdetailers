import {
  db,
  pushNotificationsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export type PushLogRow = {
  id: number;
  userId: number;
  recipientName: string | null;
  recipientRole: string | null;
  userRole: string | null;
  userPhone: string | null;
  eventType: string | null;
  reason: string | null;
  title: string;
  body: string;
  status: string;
  error: string | null;
  channel: string;
  notificationEventId: number | null;
  sentAt: Date | null;
  createdAt: Date;
};

export async function listPushNotificationLogs(filters?: {
  status?: string;
  eventType?: string;
  recipientRole?: string;
  userId?: number;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<PushLogRow[]> {
  const conditions = [];
  if (filters?.status) conditions.push(eq(pushNotificationsTable.status, filters.status));
  if (filters?.eventType) conditions.push(eq(pushNotificationsTable.eventType, filters.eventType));
  if (filters?.recipientRole) conditions.push(eq(pushNotificationsTable.recipientRole, filters.recipientRole));
  if (filters?.userId) conditions.push(eq(pushNotificationsTable.userId, filters.userId));
  if (filters?.from) conditions.push(gte(pushNotificationsTable.createdAt, new Date(filters.from)));
  if (filters?.to) {
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(pushNotificationsTable.createdAt, end));
  }

  const rows = await db
    .select({
      id: pushNotificationsTable.id,
      userId: pushNotificationsTable.userId,
      recipientName: pushNotificationsTable.recipientName,
      recipientRole: pushNotificationsTable.recipientRole,
      userRole: usersTable.role,
      userPhone: usersTable.phone,
      eventType: pushNotificationsTable.eventType,
      reason: pushNotificationsTable.reason,
      title: pushNotificationsTable.title,
      body: pushNotificationsTable.body,
      status: pushNotificationsTable.status,
      error: pushNotificationsTable.error,
      channel: pushNotificationsTable.channel,
      notificationEventId: pushNotificationsTable.notificationEventId,
      sentAt: pushNotificationsTable.sentAt,
      createdAt: pushNotificationsTable.createdAt,
    })
    .from(pushNotificationsTable)
    .leftJoin(usersTable, eq(pushNotificationsTable.userId, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sql`coalesce(${pushNotificationsTable.sentAt}, ${pushNotificationsTable.createdAt})`))
    .limit(filters?.limit ?? 200);

  return rows;
}

export async function getPushLogStats() {
  const [totals] = await db.select({
    total: sql<number>`count(*)::int`,
    sent: sql<number>`count(*) filter (where ${pushNotificationsTable.status} = 'sent')::int`,
    failed: sql<number>`count(*) filter (where ${pushNotificationsTable.status} = 'failed')::int`,
    skipped: sql<number>`count(*) filter (where ${pushNotificationsTable.status} = 'skipped')::int`,
  }).from(pushNotificationsTable);

  return totals ?? { total: 0, sent: 0, failed: 0, skipped: 0 };
}
