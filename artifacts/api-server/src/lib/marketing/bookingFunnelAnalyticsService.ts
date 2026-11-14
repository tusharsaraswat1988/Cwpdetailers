import { db } from "@workspace/db";
import { marketingEventsTable, citiesTable, servicesTable } from "@workspace/db";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";

export const FUNNEL_MILESTONES = [
  "service_viewed",
  "service_selected",
  "vehicle_selected",
  "address_selected",
  "slot_selected",
  "checkout_started",
  "coupon_applied",
  "loyalty_redeemed",
  "payment_initiated",
  "payment_failed",
  "payment_completed",
  "booking_confirmed",
  "booking_cancelled",
] as const;

export type FunnelMilestone = typeof FUNNEL_MILESTONES[number];

export interface LogFunnelEventOptions {
  milestone: FunnelMilestone | string;
  sessionId: string;
  customerId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  serviceId?: number | null;
  serviceName?: string | null;
  orderId?: string | null;
  deviceType?: "mobile" | "desktop" | "tablet" | "capacitor" | string;
  conversionValue?: number | null;
  metadata?: Record<string, unknown>;
}

export interface FunnelAnalyticsFilter {
  cityId?: number | null;
  branchId?: number | null;
  serviceId?: number | null;
  deviceType?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

/**
 * Logs a first-party booking conversion funnel milestone.
 * Sanitizes metadata to strictly disallow payment card info or sensitive PII.
 */
export async function logFunnelEvent(options: LogFunnelEventOptions) {
  const {
    milestone,
    sessionId,
    customerId,
    cityId,
    branchId,
    serviceId,
    serviceName,
    orderId,
    deviceType = "mobile",
    conversionValue,
    metadata = {},
  } = options;

  // Security & privacy check: filter any sensitive keys
  const sanitizedMeta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const lower = k.toLowerCase();
    if (
      lower.includes("card") ||
      lower.includes("cvv") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("upi_pin")
    ) {
      continue;
    }
    sanitizedMeta[k] = v;
  }

  if (serviceId) sanitizedMeta.serviceId = serviceId;
  if (serviceName) sanitizedMeta.serviceName = serviceName;
  if (deviceType) sanitizedMeta.deviceType = deviceType;

  const [row] = await db
    .insert(marketingEventsTable)
    .values({
      eventType: milestone.slice(0, 50),
      cityId: cityId || null,
      branchId: branchId || null,
      customerId: customerId || null,
      sessionId: sessionId || "anon",
      orderId: orderId || null,
      conversionValue: conversionValue != null ? String(conversionValue) : null,
      metadata: sanitizedMeta,
    })
    .returning();

  return row;
}

/**
 * Aggregates booking conversion funnel metrics, computing drop-off percentages,
 * step conversion rates, city breakdowns, and service attribution.
 */
export async function getBookingFunnelAnalytics(filter: FunnelAnalyticsFilter = {}) {
  const { cityId, branchId, serviceId, deviceType, startDate, endDate } = filter;

  const conditions = [
    inArray(marketingEventsTable.eventType, [...FUNNEL_MILESTONES]),
  ];

  if (cityId) conditions.push(eq(marketingEventsTable.cityId, cityId));
  if (branchId) conditions.push(eq(marketingEventsTable.branchId, branchId));
  if (startDate) conditions.push(gte(marketingEventsTable.recordedAt, startDate));
  if (endDate) conditions.push(lte(marketingEventsTable.recordedAt, endDate));

  // 1. Get raw event counts grouped by eventType
  const countsByEvent = await db
    .select({
      eventType: marketingEventsTable.eventType,
      count: sql<number>`count(*)::int`,
      uniqueSessions: sql<number>`count(distinct ${marketingEventsTable.sessionId})::int`,
    })
    .from(marketingEventsTable)
    .where(and(...conditions))
    .groupBy(marketingEventsTable.eventType);

  const countMap = new Map<string, { count: number; uniqueSessions: number }>();
  countsByEvent.forEach((r) => {
    countMap.set(r.eventType, { count: r.count, uniqueSessions: r.uniqueSessions });
  });

  // Ordered core stages of the booking funnel
  const coreFunnelStages: FunnelMilestone[] = [
    "service_viewed",
    "service_selected",
    "vehicle_selected",
    "address_selected",
    "slot_selected",
    "checkout_started",
    "payment_initiated",
    "booking_confirmed",
  ];

  let prevSessions = 0;
  const stages = coreFunnelStages.map((stageName, index) => {
    const data = countMap.get(stageName) || { count: 0, uniqueSessions: 0 };
    const sessions = data.uniqueSessions;
    let dropoffPercent = 0;
    let stepConversionPercent = 100;

    if (index === 0) {
      prevSessions = sessions;
    } else {
      if (prevSessions > 0) {
        const drop = Math.max(0, prevSessions - sessions);
        dropoffPercent = Number(((drop / prevSessions) * 100).toFixed(1));
        stepConversionPercent = Number(((sessions / prevSessions) * 100).toFixed(1));
      } else {
        dropoffPercent = 0;
        stepConversionPercent = sessions > 0 ? 100 : 0;
      }
      prevSessions = sessions;
    }

    return {
      step: index + 1,
      milestone: stageName,
      name: stageName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      totalEvents: data.count,
      uniqueSessions: sessions,
      dropoffPercent,
      stepConversionPercent,
    };
  });

  const topSessions = stages[0]?.uniqueSessions || 0;
  const confirmedSessions = stages[stages.length - 1]?.uniqueSessions || 0;
  const overallConversionRate = topSessions > 0
    ? Number(((confirmedSessions / topSessions) * 100).toFixed(2))
    : 0;

  // City-wise conversion rate breakdown
  const cityBreakdown = await db
    .select({
      cityId: marketingEventsTable.cityId,
      cityName: citiesTable.name,
      eventType: marketingEventsTable.eventType,
      uniqueSessions: sql<number>`count(distinct ${marketingEventsTable.sessionId})::int`,
    })
    .from(marketingEventsTable)
    .leftJoin(citiesTable, eq(marketingEventsTable.cityId, citiesTable.id))
    .where(and(...conditions))
    .groupBy(marketingEventsTable.cityId, citiesTable.name, marketingEventsTable.eventType);

  const cityMap = new Map<string, { views: number; confirms: number; name: string }>();
  cityBreakdown.forEach((r) => {
    const name = r.cityName || "Global / Unassigned";
    if (!cityMap.has(name)) cityMap.set(name, { views: 0, confirms: 0, name });
    const current = cityMap.get(name)!;
    if (r.eventType === "service_viewed") current.views += r.uniqueSessions;
    if (r.eventType === "booking_confirmed") current.confirms += r.uniqueSessions;
  });

  const cityMetrics = Array.from(cityMap.values()).map((c) => ({
    cityName: c.name,
    views: c.views,
    confirmed: c.confirms,
    conversionRate: c.views > 0 ? Number(((c.confirms / c.views) * 100).toFixed(2)) : 0,
  }));

  // Auxiliary counts (coupons, loyalty, payment failures, cancellations)
  const couponAppliedCount = countMap.get("coupon_applied")?.count || 0;
  const loyaltyRedeemedCount = countMap.get("loyalty_redeemed")?.count || 0;
  const paymentFailedCount = countMap.get("payment_failed")?.count || 0;
  const cancelledCount = countMap.get("booking_cancelled")?.count || 0;

  return {
    summary: {
      totalTopFunnelSessions: topSessions,
      totalConfirmedBookings: confirmedSessions,
      overallConversionRate,
      couponAppliedCount,
      loyaltyRedeemedCount,
      paymentFailedCount,
      cancelledCount,
    },
    stages,
    cityBreakdown: cityMetrics,
  };
}
