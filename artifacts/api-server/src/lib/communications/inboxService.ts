import { db } from "@workspace/db";
import { commConversationsTable, commSlaPoliciesTable } from "@workspace/db";
import { eq, and, desc, lt, sql, or, isNull } from "drizzle-orm";
import type { InboxFilter } from "./conversationService";

const DEFAULT_LIMIT = 50;

export async function listInbox(params: {
  filter: InboxFilter;
  userId?: number;
  companyId?: number | null;
  brandId?: number | null;
  cursor?: number;
  limit?: number;
}) {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, 100);
  const conditions = [];

  if (params.companyId) conditions.push(eq(commConversationsTable.companyId, params.companyId));
  if (params.brandId) conditions.push(eq(commConversationsTable.brandId, params.brandId));
  if (params.cursor) conditions.push(lt(commConversationsTable.id, params.cursor));

  switch (params.filter) {
    case "assigned":
      conditions.push(sql`${commConversationsTable.assignedToUserId} IS NOT NULL`);
      conditions.push(sql`${commConversationsTable.status} NOT IN ('closed', 'spam')`);
      break;
    case "unassigned":
      conditions.push(isNull(commConversationsTable.assignedToUserId));
      conditions.push(sql`${commConversationsTable.status} NOT IN ('closed', 'spam')`);
      break;
    case "my_queue":
      if (params.userId) conditions.push(eq(commConversationsTable.assignedToUserId, params.userId));
      conditions.push(sql`${commConversationsTable.status} NOT IN ('closed', 'spam')`);
      break;
    case "escalated":
      conditions.push(or(
        eq(commConversationsTable.slaStatus, "breached"),
        eq(commConversationsTable.slaStatus, "warning"),
      )!);
      conditions.push(sql`${commConversationsTable.status} NOT IN ('closed', 'spam')`);
      break;
    case "closed":
      conditions.push(eq(commConversationsTable.status, "closed"));
      break;
    case "unknown":
      conditions.push(eq(commConversationsTable.isUnknownContact, true));
      break;
    default:
      conditions.push(sql`${commConversationsTable.status} NOT IN ('spam')`);
  }

  const rows = await db.select().from(commConversationsTable)
    .where(and(...conditions))
    .orderBy(desc(commConversationsTable.lastMessageAt), desc(commConversationsTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return { items, nextCursor, hasMore };
}

export async function getInboxCounts(companyId?: number | null, userId?: number) {
  const base = companyId ? eq(commConversationsTable.companyId, companyId) : undefined;

  const [stats] = await db.select({
    open: sql<number>`count(*) filter (where ${commConversationsTable.status} = 'open')::int`,
    assigned: sql<number>`count(*) filter (where ${commConversationsTable.assignedToUserId} is not null and ${commConversationsTable.status} not in ('closed','spam'))::int`,
    unassigned: sql<number>`count(*) filter (where ${commConversationsTable.assignedToUserId} is null and ${commConversationsTable.status} not in ('closed','spam'))::int`,
    escalated: sql<number>`count(*) filter (where ${commConversationsTable.slaStatus} in ('warning','breached') and ${commConversationsTable.status} not in ('closed','spam'))::int`,
    closed: sql<number>`count(*) filter (where ${commConversationsTable.status} = 'closed')::int`,
    unknown: sql<number>`count(*) filter (where ${commConversationsTable.isUnknownContact} = true and ${commConversationsTable.status} not in ('closed','spam'))::int`,
    myQueue: userId
      ? sql<number>`count(*) filter (where ${commConversationsTable.assignedToUserId} = ${userId} and ${commConversationsTable.status} not in ('closed','spam'))::int`
      : sql<number>`0`,
    pendingReplies: sql<number>`count(*) filter (where ${commConversationsTable.status} in ('open','assigned','pending') and ${commConversationsTable.lastMessageAt} is not null)::int`,
    slaBreaches: sql<number>`count(*) filter (where ${commConversationsTable.slaStatus} = 'breached')::int`,
  }).from(commConversationsTable).where(base);

  return stats ?? {
    open: 0, assigned: 0, unassigned: 0, escalated: 0, closed: 0,
    unknown: 0, myQueue: 0, pendingReplies: 0, slaBreaches: 0,
  };
}
