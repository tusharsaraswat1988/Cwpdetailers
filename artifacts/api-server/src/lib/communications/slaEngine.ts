import { db } from "@workspace/db";
import { commConversationsTable, commSlaPoliciesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function seedDefaultSlaPolicy(companyId?: number | null) {
  const conditions = companyId
    ? and(eq(commSlaPoliciesTable.companyId, companyId), eq(commSlaPoliciesTable.isDefault, true))
    : eq(commSlaPoliciesTable.isDefault, true);

  const [existing] = await db.select().from(commSlaPoliciesTable).where(conditions).limit(1);
  if (existing) return existing;

  const [policy] = await db.insert(commSlaPoliciesTable).values({
    name: "Default SLA",
    firstResponseMinutes: 30,
    resolutionMinutes: 1440,
    escalationMinutes: 60,
    warningThresholdPct: 80,
    isDefault: true,
    companyId: companyId ?? null,
  }).returning();
  return policy!;
}

export async function applySlaToConversation(conversationId: number) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);
  if (!conv) return;

  const [policy] = await db.select().from(commSlaPoliciesTable)
    .where(and(
      conv.companyId ? eq(commSlaPoliciesTable.companyId, conv.companyId) : undefined,
      eq(commSlaPoliciesTable.isDefault, true),
    )).limit(1);

  const sla = policy ?? await seedDefaultSlaPolicy(conv.companyId);
  const now = new Date();

  await db.update(commConversationsTable).set({
    slaPolicyId: sla.id,
    firstResponseDueAt: new Date(now.getTime() + sla.firstResponseMinutes * 60_000),
    resolutionDueAt: new Date(now.getTime() + sla.resolutionMinutes * 60_000),
    slaStatus: "within_sla",
  }).where(eq(commConversationsTable.id, conversationId));
}

export async function markFirstResponse(conversationId: number) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);
  if (!conv || conv.firstResponseAt) return;

  const now = new Date();
  let slaStatus: "within_sla" | "warning" | "breached" = "within_sla";
  if (conv.firstResponseDueAt && now > conv.firstResponseDueAt) {
    slaStatus = "breached";
  }

  await db.update(commConversationsTable).set({
    firstResponseAt: now,
    slaStatus,
    status: conv.status === "open" ? "assigned" : conv.status,
  }).where(eq(commConversationsTable.id, conversationId));
}

export async function refreshSlaStatuses(companyId?: number | null) {
  const now = new Date();
  const openConvs = await db.select().from(commConversationsTable)
    .where(and(
      companyId ? eq(commConversationsTable.companyId, companyId) : undefined,
      eq(commConversationsTable.slaStatus, "within_sla"),
    ));

  let updated = 0;
  for (const conv of openConvs) {
    if (!conv.firstResponseDueAt) continue;
    const dueMs = conv.firstResponseDueAt.getTime();
    const remaining = dueMs - now.getTime();
    const total = dueMs - conv.createdAt.getTime();
    const pctUsed = total > 0 ? 1 - remaining / total : 1;

    let status: "within_sla" | "warning" | "breached" = "within_sla";
    if (remaining <= 0 && !conv.firstResponseAt) status = "breached";
    else if (pctUsed >= 0.8 && !conv.firstResponseAt) status = "warning";

    if (status !== conv.slaStatus) {
      await db.update(commConversationsTable).set({ slaStatus: status })
        .where(eq(commConversationsTable.id, conv.id));
      updated++;
    }
  }
  return { updated };
}

export async function getSlaDashboard(companyId?: number | null) {
  const { getInboxCounts } = await import("./inboxService");
  const counts = await getInboxCounts(companyId);
  return {
    openConversations: counts.open + counts.assigned,
    pendingReplies: counts.pendingReplies,
    slaBreaches: counts.slaBreaches,
    escalated: counts.escalated,
  };
}
