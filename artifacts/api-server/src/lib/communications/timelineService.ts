import { db } from "@workspace/db";
import { commTimelineTable, commEventsTable } from "@workspace/db";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import type { CommChannel } from "./channels/types";

export type TimelineInput = {
  brandId?: number | null;
  customerId?: number | null;
  leadId?: number | null;
  channel: CommChannel | string;
  templateId?: number | null;
  campaignId?: number | null;
  automationId?: number | null;
  eventId?: number | null;
  message: string;
  subject?: string | null;
  status: string;
  provider?: string | null;
  deliveryStatus?: "queued" | "processing" | "sent" | "delivered" | "read" | "failed" | "retrying" | "dead_letter";
  readStatus?: boolean;
  clicked?: boolean;
  responded?: boolean;
  metadata?: Record<string, unknown>;
  companyId?: number | null;
};

export async function recordTimelineEntry(input: TimelineInput) {
  const [row] = await db.insert(commTimelineTable).values({
    brandId: input.brandId ?? null,
    customerId: input.customerId ?? null,
    leadId: input.leadId ?? null,
    channel: input.channel as "sms",
    templateId: input.templateId ?? null,
    campaignId: input.campaignId ?? null,
    automationId: input.automationId ?? null,
    eventId: input.eventId ?? null,
    message: input.message,
    subject: input.subject ?? null,
    status: input.status,
    provider: input.provider ?? null,
    deliveryStatus: input.deliveryStatus ?? "queued",
    readStatus: input.readStatus ?? false,
    clicked: input.clicked ?? false,
    responded: input.responded ?? false,
    metadata: input.metadata ?? {},
    companyId: input.companyId ?? null,
  }).returning();
  return row!;
}

export async function syncTimelineFromEvent(eventId: number) {
  const [event] = await db.select().from(commEventsTable)
    .where(eq(commEventsTable.id, eventId)).limit(1);
  if (!event) return null;

  const deliveryMap: Record<string, TimelineInput["deliveryStatus"]> = {
    pending: "queued",
    queued: "queued",
    processing: "processing",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
    retrying: "retrying",
    dead_letter: "dead_letter",
    consent_blocked: "failed",
    skipped: "failed",
  };

  return recordTimelineEntry({
    brandId: event.brandId,
    customerId: event.customerId,
    leadId: event.leadId,
    channel: event.channel,
    templateId: event.templateId,
    campaignId: event.campaignId,
    automationId: event.automationId,
    eventId: event.id,
    message: event.renderedBody || "(pending)",
    subject: event.renderedSubject,
    status: event.status,
    deliveryStatus: deliveryMap[event.status] ?? "queued",
    readStatus: Boolean(event.readAt),
    clicked: Boolean(event.clickedAt),
    metadata: (event.metadata as Record<string, unknown>) ?? {},
    companyId: event.companyId,
  });
}

export async function getCustomerTimeline(
  customerId: number,
  opts: { brandId?: number; limit?: number; cursor?: number } = {},
) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = [eq(commTimelineTable.customerId, customerId)];
  if (opts.brandId) conditions.push(eq(commTimelineTable.brandId, opts.brandId));
  if (opts.cursor) conditions.push(lt(commTimelineTable.id, opts.cursor));

  const rows = await db.select().from(commTimelineTable)
    .where(and(...conditions))
    .orderBy(desc(commTimelineTable.createdAt), desc(commTimelineTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return { items, nextCursor, hasMore };
}

export async function getTimelineAnalytics(companyId?: number | null, brandId?: number | null) {
  const conditions: ReturnType<typeof eq>[] = [];
  if (companyId) conditions.push(eq(commTimelineTable.companyId, companyId));
  if (brandId) conditions.push(eq(commTimelineTable.brandId, brandId));

  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    delivered: sql<number>`count(*) filter (where ${commTimelineTable.deliveryStatus} in ('delivered','read'))::int`,
    read: sql<number>`count(*) filter (where ${commTimelineTable.readStatus})::int`,
    clicked: sql<number>`count(*) filter (where ${commTimelineTable.clicked})::int`,
    failed: sql<number>`count(*) filter (where ${commTimelineTable.deliveryStatus} in ('failed','dead_letter'))::int`,
  }).from(commTimelineTable)
    .where(conditions.length ? and(...conditions) : undefined);

  return stats ?? { total: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
}
