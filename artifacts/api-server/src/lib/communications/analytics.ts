import { db } from "@workspace/db";
import { commEventsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export type CommAnalytics = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  clicked: number;
  converted: number;
  revenue: number;
  byChannel: Record<string, { sent: number; failed: number }>;
  dailyTrend: Array<{ date: string; sent: number; failed: number }>;
};

export async function getCommAnalytics(
  companyId?: number | null,
  since?: Date,
): Promise<CommAnalytics> {
  const conditions: SQL[] = [];
  if (companyId) conditions.push(eq(commEventsTable.companyId, companyId));
  if (since) conditions.push(gte(commEventsTable.createdAt, since));

  const where = conditions.length ? and(...conditions) : undefined;
  const events = await db.select().from(commEventsTable).where(where).limit(50000);

  const byChannel: Record<string, { sent: number; failed: number }> = {};
  const dailyMap = new Map<string, { sent: number; failed: number }>();

  for (const e of events) {
    const ch = e.channel;
    if (!byChannel[ch]) byChannel[ch] = { sent: 0, failed: 0 };
    if (["sent", "delivered", "read", "clicked", "converted"].includes(e.status)) {
      byChannel[ch].sent++;
    } else if (e.status === "failed") {
      byChannel[ch].failed++;
    }

    const day = e.createdAt.toISOString().slice(0, 10);
    const d = dailyMap.get(day) ?? { sent: 0, failed: 0 };
    if (["sent", "delivered", "read"].includes(e.status)) d.sent++;
    if (e.status === "failed") d.failed++;
    dailyMap.set(day, d);
  }

  return {
    sent: events.filter(e => ["sent", "delivered", "read", "clicked", "converted"].includes(e.status)).length,
    delivered: events.filter(e => e.deliveredAt).length,
    read: events.filter(e => e.readAt).length,
    failed: events.filter(e => e.status === "failed").length,
    clicked: events.filter(e => e.clickedAt).length,
    converted: events.filter(e => e.convertedAt).length,
    revenue: events.reduce((s, e) => s + Number(e.revenue ?? 0), 0),
    byChannel,
    dailyTrend: [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
  };
}
