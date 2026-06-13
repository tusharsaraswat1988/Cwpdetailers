import { db } from "@workspace/db";
import {
  commChannelCostsTable, commCampaignsTable, commCampaignAttributionTable,
  commEventsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const DEFAULT_COST_PER_MESSAGE: Record<string, number> = {
  sms: 0.25,
  whatsapp: 0.45,
  email: 0.02,
  push: 0.01,
  in_app: 0,
};

export async function recordChannelCosts(campaignId: number) {
  const [campaign] = await db.select().from(commCampaignsTable)
    .where(eq(commCampaignsTable.id, campaignId)).limit(1);
  if (!campaign) return null;

  const [eventStats] = await db.select({
    sent: sql<number>`count(*) filter (where ${commEventsTable.status} in ('sent','delivered','read'))::int`,
  }).from(commEventsTable).where(eq(commEventsTable.campaignId, campaignId));

  const sent = eventStats?.sent ?? 0;
  const unitCost = DEFAULT_COST_PER_MESSAGE[campaign.channel] ?? 0;
  const cost = sent * unitCost;

  const [attr] = await db.select({
    revenue: sql<number>`coalesce(sum(cast(${commCampaignAttributionTable.revenueAmount} as numeric)), 0)`,
  }).from(commCampaignAttributionTable)
    .where(eq(commCampaignAttributionTable.campaignId, campaignId));

  const revenue = Number(attr?.revenue ?? 0);
  const profit = revenue - cost;
  const roi = cost > 0 ? Math.round((revenue / cost) * 100) / 100 : revenue > 0 ? -1 : 0;

  await db.insert(commChannelCostsTable).values({
    campaignId,
    brandId: campaign.brandId,
    channel: campaign.channel,
    messageCount: sent,
    costAmount: String(cost),
    revenueAmount: String(revenue),
    companyId: campaign.companyId,
  });

  return { campaignId, channel: campaign.channel, cost, revenue, profit, roi, sent };
}

export async function getProfitabilityReport(params: {
  companyId?: number | null;
  brandId?: number | null;
  campaignId?: number;
}) {
  const conditions = [];
  if (params.companyId) conditions.push(eq(commChannelCostsTable.companyId, params.companyId));
  if (params.brandId) conditions.push(eq(commChannelCostsTable.brandId, params.brandId));
  if (params.campaignId) conditions.push(eq(commChannelCostsTable.campaignId, params.campaignId));

  const rows = await db.select({
    channel: commChannelCostsTable.channel,
    brandId: commChannelCostsTable.brandId,
    campaignId: commChannelCostsTable.campaignId,
    messages: sql<number>`sum(${commChannelCostsTable.messageCount})::int`,
    cost: sql<number>`sum(cast(${commChannelCostsTable.costAmount} as numeric))`,
    revenue: sql<number>`sum(cast(${commChannelCostsTable.revenueAmount} as numeric))`,
  }).from(commChannelCostsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(commChannelCostsTable.channel, commChannelCostsTable.brandId, commChannelCostsTable.campaignId);

  return rows.map(r => ({
    ...r,
    cost: Number(r.cost),
    revenue: Number(r.revenue),
    profit: Number(r.revenue) - Number(r.cost),
    roi: Number(r.cost) > 0 ? Math.round(Number(r.revenue) / Number(r.cost) * 100) / 100 : 0,
  }));
}
