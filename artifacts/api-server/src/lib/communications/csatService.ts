import { db } from "@workspace/db";
import { commCsatResponsesTable, commConversationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { recordJourneyEvent } from "./journeyService";

export async function submitCsat(params: {
  conversationId: number;
  rating: number;
  feedback?: string;
  customerId?: number;
}) {
  if (params.rating < 1 || params.rating > 5) throw new Error("Rating must be 1-5");

  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, params.conversationId)).limit(1);

  const [row] = await db.insert(commCsatResponsesTable).values({
    conversationId: params.conversationId,
    customerId: params.customerId ?? conv?.customerId ?? null,
    agentUserId: conv?.assignedToUserId ?? null,
    rating: params.rating,
    feedback: params.feedback ?? null,
    companyId: conv?.companyId ?? null,
  }).returning();

  if (conv?.customerId) {
    await recordJourneyEvent({
      customerId: conv.customerId,
      eventType: "csat_submitted",
      title: `CSAT: ${params.rating}/5`,
      description: params.feedback,
      companyId: conv.companyId,
      brandId: conv.brandId,
    });
  }

  return row!;
}

export async function requestCsatSurvey(conversationId: number) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);
  if (!conv) throw new Error("Conversation not found");

  return {
    conversationId,
    message: "Thank you for chatting with us! How would you rate your experience? (1-5 stars)",
    surveyUrl: `/communications/csat/${conversationId}`,
  };
}
