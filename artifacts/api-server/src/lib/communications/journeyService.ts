import { db } from "@workspace/db";
import { commJourneyEventsTable, commTimelineTable } from "@workspace/db";
import { eq, and, desc, lt, sql } from "drizzle-orm";

export async function recordJourneyEvent(params: {
  customerId?: number | null;
  leadId?: number | null;
  eventType: string;
  title: string;
  description?: string;
  entityType?: string;
  entityId?: number;
  metadata?: Record<string, unknown>;
  brandId?: number | null;
  companyId?: number | null;
  occurredAt?: Date;
}) {
  const [row] = await db.insert(commJourneyEventsTable).values({
    customerId: params.customerId ?? null,
    leadId: params.leadId ?? null,
    eventType: params.eventType as "sms_sent",
    title: params.title,
    description: params.description ?? null,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
    brandId: params.brandId ?? null,
    companyId: params.companyId ?? null,
    occurredAt: params.occurredAt ?? new Date(),
  }).returning();
  return row!;
}

export async function getCustomerJourney(
  customerId: number,
  opts: { brandId?: number; limit?: number; cursor?: number } = {},
) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = [eq(commJourneyEventsTable.customerId, customerId)];
  if (opts.brandId) conditions.push(eq(commJourneyEventsTable.brandId, opts.brandId));
  if (opts.cursor) conditions.push(lt(commJourneyEventsTable.id, opts.cursor));

  const journeyRows = await db.select().from(commJourneyEventsTable)
    .where(and(...conditions))
    .orderBy(desc(commJourneyEventsTable.occurredAt), desc(commJourneyEventsTable.id))
    .limit(limit + 1);

  const timelineRows = await db.select().from(commTimelineTable)
    .where(and(eq(commTimelineTable.customerId, customerId)))
    .orderBy(desc(commTimelineTable.createdAt))
    .limit(limit);

  const merged = [
    ...journeyRows.map(r => ({
      id: `j-${r.id}`,
      source: "journey" as const,
      eventType: r.eventType,
      title: r.title,
      description: r.description,
      occurredAt: r.occurredAt,
      metadata: r.metadata,
    })),
    ...timelineRows.map(r => ({
      id: `t-${r.id}`,
      source: "timeline" as const,
      eventType: r.channel,
      title: r.message.slice(0, 80),
      description: r.status,
      occurredAt: r.createdAt,
      metadata: r.metadata,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);

  const hasMore = journeyRows.length > limit;
  const nextCursor = hasMore ? journeyRows[limit - 1]?.id : null;

  return { items: merged, nextCursor, hasMore };
}

export async function syncJourneyFromPlatformEvents(customerId: number, companyId?: number | null) {
  const [count] = await db.select({ c: sql<number>`count(*)::int` })
    .from(commJourneyEventsTable)
    .where(eq(commJourneyEventsTable.customerId, customerId));
  if ((count?.c ?? 0) > 0) return { synced: 0 };

  const timeline = await db.select().from(commTimelineTable)
    .where(eq(commTimelineTable.customerId, customerId))
    .orderBy(desc(commTimelineTable.createdAt))
    .limit(100);

  for (const t of timeline) {
    const typeMap: Record<string, string> = {
      sms: "sms_sent", whatsapp: "whatsapp_sent", email: "email_sent", push: "push_sent",
    };
    await recordJourneyEvent({
      customerId,
      eventType: typeMap[t.channel] ?? "sms_sent",
      title: `${t.channel} — ${t.status}`,
      description: t.message.slice(0, 200),
      brandId: t.brandId,
      companyId: companyId ?? t.companyId,
      occurredAt: t.createdAt,
    });
  }

  return { synced: timeline.length };
}
