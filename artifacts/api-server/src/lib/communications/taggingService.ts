import { db } from "@workspace/db";
import { commConversationTagsTable, AUTO_TAGS } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const TAG_KEYWORDS: Record<string, string[]> = {
  payment_issue: ["payment", "due", "refund", "invoice", "pay"],
  complaint: ["complaint", "unhappy", "angry", "worst", "bad service"],
  service_delay: ["delay", "late", "waiting", "not came", "missed"],
  interested: ["interested", "tell me more", "details", "quote"],
  hot_lead: ["book now", "confirm", "ready to pay", "when can"],
  lost_lead: ["not interested", "cancel", "stop", "unsubscribe"],
  renewal_candidate: ["renew", "extend", "expiry", "expiring"],
  solar_prospect: ["solar", "panel", "amc", "kleansolar"],
  high_value_customer: ["premium", "ceramic", "ppf", "luxury"],
};

export async function autoTagConversation(conversationId: number, messageText: string) {
  const lower = messageText.toLowerCase();
  const applied: string[] = [];

  for (const tag of AUTO_TAGS) {
    const keywords = TAG_KEYWORDS[tag] ?? [];
    if (keywords.some(kw => lower.includes(kw))) {
      const [existing] = await db.select().from(commConversationTagsTable)
        .where(and(
          eq(commConversationTagsTable.conversationId, conversationId),
          eq(commConversationTagsTable.tag, tag),
        )).limit(1);
      if (!existing) {
        await db.insert(commConversationTagsTable).values({
          conversationId,
          tag,
          source: "auto",
        });
        applied.push(tag);
      }
    }
  }

  return applied;
}

export async function addManualTag(conversationId: number, tag: string, companyId?: number | null) {
  const [row] = await db.insert(commConversationTagsTable).values({
    conversationId,
    tag,
    source: "manual",
    companyId: companyId ?? null,
  }).returning();
  return row!;
}

export async function removeTag(conversationId: number, tag: string) {
  await db.delete(commConversationTagsTable)
    .where(and(
      eq(commConversationTagsTable.conversationId, conversationId),
      eq(commConversationTagsTable.tag, tag),
    ));
}
