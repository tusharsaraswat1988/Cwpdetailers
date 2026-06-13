import { db } from "@workspace/db";
import {
  commLinkTrackingTable, commJourneyEventsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { recordJourneyEvent } from "./journeyService";

export function generateTrackingId(): string {
  return randomBytes(8).toString("hex");
}

export async function createTrackedLink(params: {
  originalUrl: string;
  campaignId?: number;
  customerId?: number;
  brandId?: number | null;
  companyId?: number | null;
}) {
  const trackingId = generateTrackingId();
  const [row] = await db.insert(commLinkTrackingTable).values({
    trackingId,
    originalUrl: params.originalUrl,
    campaignId: params.campaignId ?? null,
    customerId: params.customerId ?? null,
    brandId: params.brandId ?? null,
    companyId: params.companyId ?? null,
  }).returning();
  return { ...row!, trackUrl: `/r/${trackingId}` };
}

export async function resolveTrackedLink(trackingId: string) {
  const [link] = await db.select().from(commLinkTrackingTable)
    .where(eq(commLinkTrackingTable.trackingId, trackingId)).limit(1);
  if (!link) return null;

  await db.update(commLinkTrackingTable).set({
    clickCount: sql`${commLinkTrackingTable.clickCount} + 1`,
    visitedAt: new Date(),
  }).where(eq(commLinkTrackingTable.id, link.id));

  if (link.customerId) {
    await recordJourneyEvent({
      customerId: link.customerId,
      eventType: "link_clicked",
      title: "Campaign link clicked",
      entityType: "campaign",
      entityId: link.campaignId ?? undefined,
      brandId: link.brandId,
      companyId: link.companyId,
      metadata: { trackingId, url: link.originalUrl },
    });
  }

  return link.originalUrl;
}

export async function recordLinkConversion(trackingId: string, value: number) {
  const [link] = await db.update(commLinkTrackingTable).set({
    convertedAt: new Date(),
    conversionValue: String(value),
  }).where(eq(commLinkTrackingTable.trackingId, trackingId)).returning();
  return link ?? null;
}

export async function getLinkStats(campaignId: number) {
  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    clicks: sql<number>`coalesce(sum(${commLinkTrackingTable.clickCount}), 0)::int`,
    conversions: sql<number>`count(*) filter (where ${commLinkTrackingTable.convertedAt} is not null)::int`,
    revenue: sql<number>`coalesce(sum(cast(${commLinkTrackingTable.conversionValue} as numeric)), 0)`,
  }).from(commLinkTrackingTable)
    .where(eq(commLinkTrackingTable.campaignId, campaignId));
  return stats ?? { total: 0, clicks: 0, conversions: 0, revenue: 0 };
}
