import { db } from "@workspace/db";
import {
  marketingEventsTable,
  marketingCampaignsTable,
  promotionsTable,
  citiesTable,
} from "@workspace/db";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

export interface LogEventOptions {
  eventType: "banner_impression" | "banner_click" | "campaign_view" | "coupon_applied" | "campaign_conversion";
  bannerId?: number | null;
  campaignId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  customerId?: number | null;
  sessionId?: string | null;
  orderId?: string | null;
  conversionValue?: number | null;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsQueryOptions {
  cityId?: number | null;
  branchId?: number | null;
  campaignId?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

/**
 * Logs a marketing event and updates cached counters on banners/campaigns
 */
export async function logMarketingEvent(options: LogEventOptions) {
  const {
    eventType,
    bannerId,
    campaignId,
    cityId,
    branchId,
    customerId,
    sessionId,
    orderId,
    conversionValue,
    metadata = {},
  } = options;

  // Insert event row
  const [event] = await db
    .insert(marketingEventsTable)
    .values({
      eventType,
      bannerId: bannerId || null,
      campaignId: campaignId || null,
      cityId: cityId || null,
      branchId: branchId || null,
      customerId: customerId || null,
      sessionId: sessionId || null,
      orderId: orderId || null,
      conversionValue: conversionValue != null ? String(conversionValue) : null,
      metadata,
    })
    .returning();

  // Atomically update banner counters if applicable
  if (bannerId) {
    if (eventType === "banner_impression") {
      db.update(promotionsTable)
        .set({
          impressionCount: sql`${promotionsTable.impressionCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(promotionsTable.id, bannerId))
        .catch(() => {});
    } else if (eventType === "banner_click") {
      db.update(promotionsTable)
        .set({
          clickCount: sql`${promotionsTable.clickCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(promotionsTable.id, bannerId))
        .catch(() => {});
    }
  }

  return event;
}

/**
 * Computes aggregated marketing metrics with CTR % and campaign revenue
 */
export async function getMarketingAnalyticsSummary(options: AnalyticsQueryOptions = {}) {
  const { cityId, branchId, campaignId, startDate, endDate } = options;

  const conditions = [];
  if (cityId) conditions.push(eq(marketingEventsTable.cityId, cityId));
  if (branchId) conditions.push(eq(marketingEventsTable.branchId, branchId));
  if (campaignId) conditions.push(eq(marketingEventsTable.campaignId, campaignId));
  if (startDate) conditions.push(gte(marketingEventsTable.recordedAt, startDate));
  if (endDate) conditions.push(lte(marketingEventsTable.recordedAt, endDate));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Aggregated event counts
  const [metrics] = await db
    .select({
      totalImpressions: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEventsTable.eventType} = 'banner_impression' THEN 1 ELSE 0 END), 0)::int`,
      totalClicks: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEventsTable.eventType} = 'banner_click' THEN 1 ELSE 0 END), 0)::int`,
      totalCampaignViews: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEventsTable.eventType} = 'campaign_view' THEN 1 ELSE 0 END), 0)::int`,
      totalCouponsApplied: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEventsTable.eventType} = 'coupon_applied' THEN 1 ELSE 0 END), 0)::int`,
      totalConversions: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEventsTable.eventType} = 'campaign_conversion' THEN 1 ELSE 0 END), 0)::int`,
      attributedRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${marketingEventsTable.eventType} = 'campaign_conversion' THEN CAST(${marketingEventsTable.conversionValue} AS NUMERIC) ELSE 0 END), 0)::float`,
    })
    .from(marketingEventsTable)
    .where(whereClause);

  const impressions = metrics?.totalImpressions || 0;
  const clicks = metrics?.totalClicks || 0;
  const ctrPercent = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;

  // Top campaigns breakdown
  const topCampaigns = await db
    .select({
      campaignId: marketingCampaignsTable.id,
      code: marketingCampaignsTable.code,
      name: marketingCampaignsTable.name,
      offerType: marketingCampaignsTable.offerType,
      discountValue: marketingCampaignsTable.discountValue,
      usedCount: marketingCampaignsTable.usedCount,
      usageLimit: marketingCampaignsTable.usageLimit,
      isActive: marketingCampaignsTable.isActive,
    })
    .from(marketingCampaignsTable)
    .orderBy(desc(marketingCampaignsTable.usedCount))
    .limit(10);

  // Top banners breakdown
  const topBanners = await db
    .select({
      id: promotionsTable.id,
      title: promotionsTable.title,
      placement: promotionsTable.placement,
      cityId: promotionsTable.cityId,
      cityName: citiesTable.name,
      impressionCount: promotionsTable.impressionCount,
      clickCount: promotionsTable.clickCount,
      ctr: sql<number>`CASE WHEN ${promotionsTable.impressionCount} > 0 THEN ROUND((CAST(${promotionsTable.clickCount} AS NUMERIC) / CAST(${promotionsTable.impressionCount} AS NUMERIC)) * 100, 2) ELSE 0 END::float`,
    })
    .from(promotionsTable)
    .leftJoin(citiesTable, eq(promotionsTable.cityId, citiesTable.id))
    .where(eq(promotionsTable.isActive, true))
    .orderBy(desc(promotionsTable.clickCount))
    .limit(10);

  return {
    overview: {
      totalImpressions: impressions,
      totalClicks: clicks,
      ctrPercent,
      totalCouponsApplied: metrics?.totalCouponsApplied || 0,
      totalConversions: metrics?.totalConversions || 0,
      attributedRevenue: metrics?.attributedRevenue || 0,
    },
    topCampaigns,
    topBanners,
  };
}
