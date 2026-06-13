import { db } from "@workspace/db";
import {
  commEventsTable, commCampaignsTable, commTemplatesTable,
} from "@workspace/db";
import { eq, and, gte, sql, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

function startOfTodayIST(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - istOffset);
}

export async function getSprint1Dashboard(companyId?: number | null) {
  const todayStart = startOfTodayIST();
  const conditions: SQL[] = [gte(commEventsTable.createdAt, todayStart)];
  if (companyId) conditions.push(eq(commEventsTable.companyId, companyId));
  const eventWhere = and(...conditions);

  const [todayStats] = await db.select({
    sentToday: sql<number>`count(*) filter (where ${commEventsTable.status} in ('sent','delivered','read','clicked','converted'))::int`,
    failedToday: sql<number>`count(*) filter (where ${commEventsTable.status} in ('failed','dead_letter','consent_blocked'))::int`,
  }).from(commEventsTable).where(eventWhere);

  const campaignConditions: SQL[] = [];
  if (companyId) campaignConditions.push(eq(commCampaignsTable.companyId, companyId));
  const campaignWhere = campaignConditions.length ? and(...campaignConditions) : undefined;

  const [campaignCount] = await db.select({ total: sql<number>`count(*)::int` })
    .from(commCampaignsTable).where(campaignWhere);

  const templateConditions: SQL[] = [eq(commTemplatesTable.channel, "sms")];
  if (companyId) templateConditions.push(eq(commTemplatesTable.companyId, companyId));

  const [templateCount] = await db.select({ total: sql<number>`count(*)::int` })
    .from(commTemplatesTable).where(and(...templateConditions));

  return {
    sentToday: todayStats?.sentToday ?? 0,
    failedToday: todayStats?.failedToday ?? 0,
    campaignCount: campaignCount?.total ?? 0,
    templateCount: templateCount?.total ?? 0,
  };
}
