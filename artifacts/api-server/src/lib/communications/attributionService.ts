import { db } from "@workspace/db";
import {
  commCampaignAttributionTable, commCampaignsTable, commEventsTable,
  bookingsTable, invoicesTable,
} from "@workspace/db";
import { eq, and, gte, inArray, sql, desc } from "drizzle-orm";

const ATTRIBUTION_WINDOW_DAYS = 30;

export async function processCampaignAttribution(campaignId?: number) {
  const campaignFilter = campaignId
    ? eq(commEventsTable.campaignId, campaignId)
    : sql`${commEventsTable.campaignId} IS NOT NULL`;

  const sentEvents = await db.select({
    campaignId: commEventsTable.campaignId,
    customerId: commEventsTable.customerId,
    sentAt: commEventsTable.sentAt,
    companyId: commEventsTable.companyId,
  }).from(commEventsTable)
    .where(and(
      campaignFilter,
      inArray(commEventsTable.status, ["sent", "delivered", "read", "clicked", "converted"]),
      sql`${commEventsTable.customerId} IS NOT NULL`,
      sql`${commEventsTable.sentAt} IS NOT NULL`,
    ));

  const attributed: number[] = [];

  for (const event of sentEvents) {
    if (!event.campaignId || !event.customerId || !event.sentAt) continue;

    const windowEnd = new Date(event.sentAt.getTime() + ATTRIBUTION_WINDOW_DAYS * 86400000);

    const [existing] = await db.select({ id: commCampaignAttributionTable.id })
      .from(commCampaignAttributionTable)
      .where(and(
        eq(commCampaignAttributionTable.campaignId, event.campaignId),
        eq(commCampaignAttributionTable.customerId, event.customerId),
      )).limit(1);
    if (existing) continue;

    const [booking] = await db.select({
      id: bookingsTable.id,
      amount: bookingsTable.amount,
    }).from(bookingsTable)
      .where(and(
        eq(bookingsTable.customerId, event.customerId),
        gte(bookingsTable.createdAt, event.sentAt),
        sql`${bookingsTable.createdAt} <= ${windowEnd}`,
        eq(bookingsTable.status, "completed"),
      ))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(1);

    const [invoice] = await db.select({
      id: invoicesTable.id,
      totalAmount: invoicesTable.totalAmount,
    }).from(invoicesTable)
      .where(and(
        eq(invoicesTable.customerId, event.customerId),
        gte(invoicesTable.createdAt, event.sentAt),
        sql`${invoicesTable.createdAt} <= ${windowEnd}`,
        inArray(invoicesTable.status, ["sent", "paid"]),
      ))
      .orderBy(desc(invoicesTable.createdAt))
      .limit(1);

    if (!booking && !invoice) continue;

    const revenue = Number(invoice?.totalAmount ?? booking?.amount ?? 0);
    if (revenue <= 0) continue;

    const [attr] = await db.insert(commCampaignAttributionTable).values({
      campaignId: event.campaignId,
      customerId: event.customerId,
      bookingId: booking?.id ?? null,
      invoiceId: invoice?.id ?? null,
      revenueAmount: String(revenue),
      companyId: event.companyId,
    }).returning();

    attributed.push(attr!.id);

    await db.update(commEventsTable).set({
      status: "converted",
      convertedAt: new Date(),
      revenue: String(revenue),
    }).where(and(
      eq(commEventsTable.campaignId, event.campaignId),
      eq(commEventsTable.customerId, event.customerId),
    ));
  }

  if (campaignId) await refreshCampaignStats(campaignId);
  else {
    const ids = [...new Set(sentEvents.map(e => e.campaignId).filter(Boolean))] as number[];
    for (const id of ids) await refreshCampaignStats(id);
  }

  return { attributed: attributed.length };
}

export async function refreshCampaignStats(campaignId: number) {
  const [campaign] = await db.select().from(commCampaignsTable)
    .where(eq(commCampaignsTable.id, campaignId)).limit(1);
  if (!campaign) return;

  const events = await db.select().from(commEventsTable)
    .where(eq(commEventsTable.campaignId, campaignId));

  const attributions = await db.select().from(commCampaignAttributionTable)
    .where(eq(commCampaignAttributionTable.campaignId, campaignId));

  const revenue = attributions.reduce((s, a) => s + Number(a.revenueAmount), 0);
  const bookingsGenerated = attributions.filter(a => a.bookingId).length;
  const invoicesGenerated = attributions.filter(a => a.invoiceId).length;
  const cost = Number(campaign.costAmount ?? 0);
  const roi = cost > 0 ? Math.round((revenue / cost) * 100) / 100 : revenue > 0 ? null : 0;

  const stats = {
    ...(campaign.stats ?? {}),
    sent: events.filter(e => ["sent", "delivered", "read", "clicked", "converted"].includes(e.status)).length,
    failed: events.filter(e => e.status === "failed").length,
    delivered: events.filter(e => e.deliveredAt).length,
    read: events.filter(e => e.readAt).length,
    consentBlocked: events.filter(e => e.status === "consent_blocked").length,
    bookingsGenerated,
    invoicesGenerated,
    revenue,
    roi: roi ?? undefined,
  };

  await db.update(commCampaignsTable).set({ stats }).where(eq(commCampaignsTable.id, campaignId));
  return stats;
}

export async function getCampaignAttributionDetail(campaignId: number) {
  const attributions = await db.select().from(commCampaignAttributionTable)
    .where(eq(commCampaignAttributionTable.campaignId, campaignId))
    .orderBy(commCampaignAttributionTable.attributedAt);

  const totalRevenue = attributions.reduce((s, a) => s + Number(a.revenueAmount), 0);

  return {
    attributions,
    summary: {
      customers: new Set(attributions.map(a => a.customerId)).size,
      bookings: attributions.filter(a => a.bookingId).length,
      invoices: attributions.filter(a => a.invoiceId).length,
      revenue: totalRevenue,
    },
  };
}
