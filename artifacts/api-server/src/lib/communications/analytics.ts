import { db } from "@workspace/db";
import {
  commEventsTable, commCampaignsTable, commAutomationsTable,
  commCampaignAttributionTable,
} from "@workspace/db";
import { eq, and, gte, sql, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getConsentAnalytics } from "./consentService";
import { getQueueStats } from "./queueService";
import { getTimelineAnalytics } from "./timelineService";
import { commWorkflowsTable } from "@workspace/db";

export type CommAnalytics = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  clicked: number;
  converted: number;
  revenue: number;
  consentBlocked: number;
  consentRate: number;
  totalCampaigns: number;
  activeAutomations: number;
  roi: number;
  byChannel: Record<string, { sent: number; failed: number; delivered: number }>;
  dailyTrend: Array<{ date: string; sent: number; failed: number; revenue: number }>;
  channelPerformance: Array<{ channel: string; sent: number; failed: number; revenue: number }>;
  campaignRoi: Array<{ campaignId: number; name: string; revenue: number; cost: number; roi: number }>;
};

export async function getCommAnalytics(
  companyId?: number | null,
  since?: Date,
): Promise<CommAnalytics> {
  const conditions: SQL[] = [];
  if (companyId) conditions.push(eq(commEventsTable.companyId, companyId));
  if (since) conditions.push(gte(commEventsTable.createdAt, since));
  const where = conditions.length ? and(...conditions) : undefined;

  const [eventAgg] = await db.select({
    sent: sql<number>`count(*) filter (where ${commEventsTable.status} in ('sent','delivered','read','clicked','converted'))::int`,
    delivered: sql<number>`count(*) filter (where ${commEventsTable.deliveredAt} is not null)::int`,
    read: sql<number>`count(*) filter (where ${commEventsTable.readAt} is not null)::int`,
    failed: sql<number>`count(*) filter (where ${commEventsTable.status} = 'failed')::int`,
    clicked: sql<number>`count(*) filter (where ${commEventsTable.clickedAt} is not null)::int`,
    converted: sql<number>`count(*) filter (where ${commEventsTable.status} = 'converted')::int`,
    consentBlocked: sql<number>`count(*) filter (where ${commEventsTable.status} = 'consent_blocked')::int`,
    revenue: sql<number>`coalesce(sum(case when ${commEventsTable.revenue} is not null then cast(${commEventsTable.revenue} as numeric) else 0 end), 0)`,
  }).from(commEventsTable).where(where);

  const channelRows = await db.select({
    channel: commEventsTable.channel,
    sent: sql<number>`count(*) filter (where ${commEventsTable.status} in ('sent','delivered','read','clicked','converted'))::int`,
    failed: sql<number>`count(*) filter (where ${commEventsTable.status} = 'failed')::int`,
    delivered: sql<number>`count(*) filter (where ${commEventsTable.deliveredAt} is not null)::int`,
    revenue: sql<number>`coalesce(sum(case when ${commEventsTable.revenue} is not null then cast(${commEventsTable.revenue} as numeric) else 0 end), 0)`,
  }).from(commEventsTable).where(where).groupBy(commEventsTable.channel);

  const dailyRows = await db.select({
    date: sql<string>`to_char(${commEventsTable.createdAt}, 'YYYY-MM-DD')`,
    sent: sql<number>`count(*) filter (where ${commEventsTable.status} in ('sent','delivered','read'))::int`,
    failed: sql<number>`count(*) filter (where ${commEventsTable.status} = 'failed')::int`,
    revenue: sql<number>`coalesce(sum(case when ${commEventsTable.revenue} is not null then cast(${commEventsTable.revenue} as numeric) else 0 end), 0)`,
  }).from(commEventsTable).where(where)
    .groupBy(sql`to_char(${commEventsTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${commEventsTable.createdAt}, 'YYYY-MM-DD')`);

  const campaignConditions: SQL[] = [];
  if (companyId) campaignConditions.push(eq(commCampaignsTable.companyId, companyId));
  const campaignWhere = campaignConditions.length ? and(...campaignConditions) : undefined;

  const [campaignCount] = await db.select({ total: count() }).from(commCampaignsTable).where(campaignWhere);

  const automationConditions: SQL[] = [eq(commAutomationsTable.isActive, true)];
  if (companyId) automationConditions.push(eq(commAutomationsTable.companyId, companyId));
  const [automationCount] = await db.select({ total: count() })
    .from(commAutomationsTable).where(and(...automationConditions));

  const campaigns = await db.select({
    id: commCampaignsTable.id,
    name: commCampaignsTable.name,
    costAmount: commCampaignsTable.costAmount,
    stats: commCampaignsTable.stats,
  }).from(commCampaignsTable).where(campaignWhere).limit(50);

  const attrConditions: SQL[] = [];
  if (companyId) attrConditions.push(eq(commCampaignAttributionTable.companyId, companyId));
  if (since) attrConditions.push(gte(commCampaignAttributionTable.attributedAt, since));

  const attrRevenue = await db.select({
    total: sql<number>`coalesce(sum(cast(${commCampaignAttributionTable.revenueAmount} as numeric)), 0)`,
  }).from(commCampaignAttributionTable).where(attrConditions.length ? and(...attrConditions) : undefined);

  const totalRevenue = Number(attrRevenue[0]?.total ?? eventAgg?.revenue ?? 0);
  const totalCost = campaigns.reduce((s, c) => s + Number(c.costAmount ?? 0), 0);
  const roi = totalCost > 0 ? Math.round((totalRevenue / totalCost) * 100) / 100 : 0;

  const consentStats = await getConsentAnalytics(companyId);

  const byChannel: CommAnalytics["byChannel"] = {};
  for (const row of channelRows) {
    byChannel[row.channel] = { sent: row.sent, failed: row.failed, delivered: row.delivered };
  }

  const campaignRoi = campaigns.map(c => {
    const rev = Number((c.stats as { revenue?: number })?.revenue ?? 0);
    const cost = Number(c.costAmount ?? 0);
    return {
      campaignId: c.id,
      name: c.name,
      revenue: rev,
      cost,
      roi: cost > 0 ? Math.round((rev / cost) * 100) / 100 : rev > 0 ? -1 : 0,
    };
  }).filter(c => c.revenue > 0 || c.cost > 0);

  return {
    sent: eventAgg?.sent ?? 0,
    delivered: eventAgg?.delivered ?? 0,
    read: eventAgg?.read ?? 0,
    failed: eventAgg?.failed ?? 0,
    clicked: eventAgg?.clicked ?? 0,
    converted: eventAgg?.converted ?? 0,
    revenue: totalRevenue,
    consentBlocked: eventAgg?.consentBlocked ?? 0,
    consentRate: consentStats.consentRate,
    totalCampaigns: campaignCount?.total ?? 0,
    activeAutomations: automationCount?.total ?? 0,
    roi,
    byChannel,
    dailyTrend: dailyRows.map(r => ({
      date: r.date,
      sent: r.sent,
      failed: r.failed,
      revenue: Number(r.revenue),
    })),
    channelPerformance: channelRows.map(r => ({
      channel: r.channel,
      sent: r.sent,
      failed: r.failed,
      revenue: Number(r.revenue),
    })),
    campaignRoi,
  };
}

export async function getDashboardAnalytics(companyId?: number | null, days = 30, brandId?: number | null) {
  const since = new Date(Date.now() - days * 86400000);
  const base = await getCommAnalytics(companyId, since);
  const queueStats = await getQueueStats(companyId);
  const timelineStats = await getTimelineAnalytics(companyId, brandId ?? undefined);

  const workflowConditions: SQL[] = [eq(commWorkflowsTable.isActive, true)];
  if (companyId) workflowConditions.push(eq(commWorkflowsTable.companyId, companyId));
  if (brandId) workflowConditions.push(eq(commWorkflowsTable.brandId, brandId));
  const [workflowCount] = await db.select({ total: count() })
    .from(commWorkflowsTable).where(and(...workflowConditions));

  return {
    ...base,
    queueStats,
    timelineStats,
    activeWorkflows: workflowCount?.total ?? 0,
    brandId: brandId ?? null,
  };
}
