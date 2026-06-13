import { db } from "@workspace/db";
import {
  commTicketRulesTable, commConversationsTable, complaintsTable,
  commConversationTagsTable, commAiAssistanceTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { recordJourneyEvent } from "./journeyService";
import { logCommAudit } from "./audit";

const DEFAULT_RULES = [
  { name: "Complaint Auto-Ticket", trigger: "complaint_detected" as const, tagMatch: "complaint", complaintType: "quality" },
  { name: "Payment Issue Ticket", trigger: "payment_issue" as const, tagMatch: "payment_issue", complaintType: "billing" },
  { name: "Escalation Ticket", trigger: "escalation_request" as const, tagMatch: null, complaintType: "other" },
] as const;

export async function seedTicketRules(companyId?: number | null) {
  const existing = await db.select().from(commTicketRulesTable)
    .where(companyId ? eq(commTicketRulesTable.companyId, companyId) : undefined);
  if (existing.length) return existing;

  return db.insert(commTicketRulesTable).values(
    DEFAULT_RULES.map(r => ({
      name: r.name,
      trigger: r.trigger,
      tagMatch: r.tagMatch,
      complaintType: r.complaintType,
      isActive: true,
      companyId: companyId ?? null,
    })),
  ).returning();
}

export async function evaluateTicketRules(conversationId: number) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);
  if (!conv || conv.complaintId || !conv.customerId) return null;

  await seedTicketRules(conv.companyId);
  const rules = await db.select().from(commTicketRulesTable)
    .where(and(
      eq(commTicketRulesTable.isActive, true),
      conv.companyId ? eq(commTicketRulesTable.companyId, conv.companyId) : undefined,
    ));

  const tags = await db.select().from(commConversationTagsTable)
    .where(eq(commConversationTagsTable.conversationId, conversationId));
  const tagSet = new Set(tags.map(t => t.tag));

  const [ai] = await db.select().from(commAiAssistanceTable)
    .where(eq(commAiAssistanceTable.conversationId, conversationId)).limit(1);

  for (const rule of rules) {
    let match = false;
    if (rule.tagMatch && tagSet.has(rule.tagMatch)) match = true;
    if (rule.trigger === "sla_breach" && conv.slaStatus === "breached") match = true;
    if (rule.intentMatch && ai?.intent === rule.intentMatch) match = true;
    if (rule.trigger === "escalation_request" && ai?.priority === "high") match = true;

    if (!match) continue;

    const title = `Auto-ticket: ${rule.name}`;
    const [ticket] = await db.insert(complaintsTable).values({
      customerId: conv.customerId,
      type: (rule.complaintType ?? "other") as "quality",
      title,
      description: conv.lastMessagePreview ?? "Created from conversation",
      status: "open",
      priority: ai?.priority === "high" ? "high" : "medium",
      companyId: conv.companyId,
      branchId: conv.branchId,
    }).returning();

    await db.update(commConversationsTable).set({ complaintId: ticket!.id })
      .where(eq(commConversationsTable.id, conversationId));

    await recordJourneyEvent({
      customerId: conv.customerId,
      eventType: "ticket_created",
      title,
      entityType: "complaint",
      entityId: ticket!.id,
      companyId: conv.companyId,
      brandId: conv.brandId,
    });

    await logCommAudit({
      action: "ticket.auto_create",
      resource: "conversation",
      resourceId: conversationId,
      companyId: conv.companyId,
      payload: { ruleId: rule.id, complaintId: ticket!.id },
    });

    return ticket;
  }

  return null;
}
