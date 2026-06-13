import { db } from "@workspace/db";
import {
  commConversationMessagesTable, commConversationsTable,
  commCsatResponsesTable, commAgentMetricsTable, commCampaignAttributionTable,
} from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";

export async function computeAgentMetrics(userId: number, periodDate: string, companyId?: number | null) {
  const dayStart = new Date(`${periodDate}T00:00:00`);
  const dayEnd = new Date(`${periodDate}T23:59:59`);

  const [msgStats] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(commConversationMessagesTable)
    .where(and(
      eq(commConversationMessagesTable.senderUserId, userId),
      gte(commConversationMessagesTable.createdAt, dayStart),
      sql`${commConversationMessagesTable.createdAt} <= ${dayEnd}`,
    ));

  const [closedStats] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(commConversationsTable)
    .where(and(
      eq(commConversationsTable.assignedToUserId, userId),
      eq(commConversationsTable.status, "closed"),
      gte(commConversationsTable.closedAt, dayStart),
      sql`${commConversationsTable.closedAt} <= ${dayEnd}`,
    ));

  const [csatStats] = await db.select({
    avg: sql<number>`avg(${commCsatResponsesTable.rating})`,
  }).from(commCsatResponsesTable)
    .where(and(
      eq(commCsatResponsesTable.agentUserId, userId),
      gte(commCsatResponsesTable.createdAt, dayStart),
    ));

  const [row] = await db.insert(commAgentMetricsTable).values({
    userId,
    periodDate,
    messagesHandled: msgStats?.count ?? 0,
    conversationsClosed: closedStats?.count ?? 0,
    avgResponseTimeSec: 0,
    csatAvg: csatStats?.avg != null ? String(csatStats.avg) : null,
    revenueGenerated: "0",
    companyId: companyId ?? null,
  }).returning();

  return row;
}

export async function getTeamPerformance(companyId?: number | null, periodDate?: string) {
  const date = periodDate ?? new Date().toISOString().slice(0, 10);
  const conditions = [eq(commAgentMetricsTable.periodDate, date)];
  if (companyId) conditions.push(eq(commAgentMetricsTable.companyId, companyId));

  return db.select().from(commAgentMetricsTable).where(and(...conditions));
}

export async function getCsatDashboard(companyId?: number | null) {
  const conditions = companyId ? [eq(commCsatResponsesTable.companyId, companyId)] : [];

  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    avgRating: sql<number>`avg(${commCsatResponsesTable.rating})`,
    satisfied: sql<number>`count(*) filter (where ${commCsatResponsesTable.rating} >= 4)::int`,
  }).from(commCsatResponsesTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const total = stats?.total ?? 0;
  const satisfied = stats?.satisfied ?? 0;

  return {
    totalResponses: total,
    avgRating: stats?.avgRating != null ? Math.round(Number(stats.avgRating) * 10) / 10 : 0,
    satisfactionPct: total > 0 ? Math.round((satisfied / total) * 1000) / 10 : 0,
  };
}
