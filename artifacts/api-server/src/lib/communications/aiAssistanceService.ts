/** AI readiness — no external AI calls; stores placeholder suggestions */
import { db } from "@workspace/db";
import { commAiAssistanceTable, commConversationTagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function detectSentiment(text: string): string {
  const lower = text.toLowerCase();
  if (/angry|worst|bad|unhappy|complaint/.test(lower)) return "negative";
  if (/thank|great|good|happy|excellent/.test(lower)) return "positive";
  return "neutral";
}

function detectIntent(text: string): string {
  const lower = text.toLowerCase();
  if (/payment|due|invoice|refund/.test(lower)) return "payment";
  if (/book|schedule|appointment/.test(lower)) return "booking";
  if (/price|quote|cost/.test(lower)) return "sales";
  if (/complaint|delay|issue/.test(lower)) return "support";
  return "general";
}

export async function queueAiAssistancePlaceholder(conversationId: number) {
  const [existing] = await db.select().from(commAiAssistanceTable)
    .where(eq(commAiAssistanceTable.conversationId, conversationId)).limit(1);
  if (existing) return existing;

  const [row] = await db.insert(commAiAssistanceTable).values({
    conversationId,
    status: "pending",
    summary: null,
    sentiment: null,
    intent: null,
    priority: "normal",
    replySuggestions: [],
  }).returning();
  return row!;
}

export async function refreshAiAssistance(conversationId: number, lastMessages: string[]) {
  const combined = lastMessages.join(" ");
  const sentiment = detectSentiment(combined);
  const intent = detectIntent(combined);
  const priority = sentiment === "negative" ? "high" : intent === "sales" ? "medium" : "normal";

  const tags = await db.select().from(commConversationTagsTable)
    .where(eq(commConversationTagsTable.conversationId, conversationId));

  const suggestions: string[] = [];
  if (intent === "payment") suggestions.push("I can help you with your payment. Let me check your account.");
  if (intent === "booking") suggestions.push("Would you like to schedule a service? I can find the next available slot.");
  if (intent === "support") suggestions.push("I'm sorry for the inconvenience. Let me look into this right away.");
  if (intent === "sales") suggestions.push("I'd be happy to share our packages and pricing with you.");

  const summary = lastMessages.length
    ? `Conversation (${lastMessages.length} messages): ${combined.slice(0, 300)}`
    : null;

  const [row] = await db.update(commAiAssistanceTable).set({
    summary,
    sentiment,
    intent,
    priority,
    replySuggestions: suggestions,
    leadQualificationHints: {
      tags: tags.map(t => t.tag),
      intent,
      sentiment,
    },
    status: "ready",
    updatedAt: new Date(),
  }).where(eq(commAiAssistanceTable.conversationId, conversationId)).returning();

  if (!row) {
    const [created] = await db.insert(commAiAssistanceTable).values({
      conversationId,
      summary, sentiment, intent, priority,
      replySuggestions: suggestions,
      status: "ready",
    }).returning();
    return created!;
  }
  return row;
}

export async function getAiAssistance(conversationId: number) {
  const [row] = await db.select().from(commAiAssistanceTable)
    .where(eq(commAiAssistanceTable.conversationId, conversationId)).limit(1);
  return row ?? null;
}
