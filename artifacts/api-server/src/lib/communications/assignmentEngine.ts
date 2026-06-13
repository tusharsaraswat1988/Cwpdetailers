import { db } from "@workspace/db";
import {
  commConversationsTable, commTeamsTable, DEFAULT_TEAMS,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logCommAudit } from "./audit";

export async function seedDefaultTeams(companyId?: number | null) {
  const existing = await db.select().from(commTeamsTable)
    .where(companyId ? eq(commTeamsTable.companyId, companyId) : undefined);
  if (existing.length) return existing;

  return db.insert(commTeamsTable).values(
    DEFAULT_TEAMS.map(t => ({
      name: t.name,
      code: t.code,
      description: t.description,
      companyId: companyId ?? null,
    })),
  ).returning();
}

const KEYWORD_TEAM_MAP: Record<string, string> = {
  solar: "solar",
  amc: "solar",
  panel: "solar",
  wash: "service",
  detailing: "service",
  ceramic: "service",
  ppf: "service",
  quote: "sales",
  price: "sales",
  interested: "sales",
  payment: "support",
  refund: "support",
  complaint: "support",
  delay: "support",
};

export async function autoAssignConversation(conversationId: number) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);
  if (!conv || conv.assignedTeamId) return null;

  await seedDefaultTeams(conv.companyId);
  const preview = (conv.lastMessagePreview ?? conv.subject ?? "").toLowerCase();
  let teamCode = "support";

  for (const [keyword, code] of Object.entries(KEYWORD_TEAM_MAP)) {
    if (preview.includes(keyword)) {
      teamCode = code;
      break;
    }
  }

  if (conv.leadId && !conv.customerId) teamCode = "sales";

  const [team] = await db.select().from(commTeamsTable)
    .where(and(
      eq(commTeamsTable.code, teamCode),
      conv.companyId ? eq(commTeamsTable.companyId, conv.companyId) : undefined,
    )).limit(1);

  if (team) {
    await db.update(commConversationsTable).set({
      assignedTeamId: team.id,
      status: "assigned",
    }).where(eq(commConversationsTable.id, conversationId));
  }

  return team ?? null;
}

export async function assignConversation(params: {
  conversationId: number;
  userId?: number | null;
  teamId?: number | null;
  assignedBy?: number;
}) {
  const updates: Partial<typeof commConversationsTable.$inferInsert> = {
    status: "assigned",
    updatedAt: new Date(),
  };
  if (params.userId != null) updates.assignedToUserId = params.userId;
  if (params.teamId != null) updates.assignedTeamId = params.teamId;

  const [conv] = await db.update(commConversationsTable).set(updates)
    .where(eq(commConversationsTable.id, params.conversationId)).returning();

  await logCommAudit({
    action: "conversation.assign",
    resource: "conversation",
    resourceId: params.conversationId,
    userId: params.assignedBy,
    companyId: conv?.companyId,
    brandId: conv?.brandId,
    payload: { userId: params.userId, teamId: params.teamId },
  });

  return conv;
}

export async function listTeams(companyId?: number | null) {
  await seedDefaultTeams(companyId);
  return db.select().from(commTeamsTable)
    .where(companyId ? eq(commTeamsTable.companyId, companyId) : undefined);
}
