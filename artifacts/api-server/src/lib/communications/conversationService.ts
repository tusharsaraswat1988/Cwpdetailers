import { db } from "@workspace/db";
import {
  commConversationsTable, commConversationMessagesTable, commConversationNotesTable,
  commConversationTagsTable, commUnknownContactsTable, commJourneyEventsTable,
  customersTable, leadsTable, type CommConversation,
} from "@workspace/db";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { logCommAudit } from "./audit";
import { recordJourneyEvent } from "./journeyService";
import { applySlaToConversation, markFirstResponse } from "./slaEngine";
import { autoAssignConversation } from "./assignmentEngine";
import { autoTagConversation } from "./taggingService";
import { queueAiAssistancePlaceholder } from "./aiAssistanceService";
import { sendViaChannel } from "./channels/channelService";

export type InboxFilter =
  | "all" | "assigned" | "unassigned" | "my_queue" | "escalated" | "closed" | "unknown";

export async function findOrCreateConversation(params: {
  customerId?: number | null;
  leadId?: number | null;
  brandId?: number | null;
  channel: string;
  phone?: string | null;
  email?: string | null;
  emailThreadId?: string | null;
  companyId?: number | null;
  subject?: string | null;
}) {
  if (params.customerId) {
    const [existing] = await db.select().from(commConversationsTable)
      .where(and(
        eq(commConversationsTable.customerId, params.customerId),
        eq(commConversationsTable.primaryChannel, params.channel as "whatsapp"),
        sql`${commConversationsTable.status} NOT IN ('closed', 'spam')`,
      ))
      .orderBy(desc(commConversationsTable.lastMessageAt))
      .limit(1);
    if (existing) return existing;
  }

  if (params.emailThreadId) {
    const [existing] = await db.select().from(commConversationsTable)
      .where(eq(commConversationsTable.emailThreadId, params.emailThreadId)).limit(1);
    if (existing) return existing;
  }

  const isUnknown = !params.customerId && !params.leadId;
  const [conv] = await db.insert(commConversationsTable).values({
    customerId: params.customerId ?? null,
    leadId: params.leadId ?? null,
    brandId: params.brandId ?? null,
    primaryChannel: params.channel as "whatsapp",
    subject: params.subject ?? null,
    emailThreadId: params.emailThreadId ?? null,
    isUnknownContact: isUnknown,
    unknownPhone: isUnknown ? params.phone ?? null : null,
    unknownEmail: isUnknown ? params.email ?? null : null,
    status: isUnknown ? "open" : "open",
    companyId: params.companyId ?? null,
    lastMessageAt: new Date(),
  }).returning();

  if (isUnknown && (params.phone || params.email)) {
    await db.insert(commUnknownContactsTable).values({
      conversationId: conv!.id,
      phone: params.phone ?? null,
      email: params.email ?? null,
      channel: params.channel as "whatsapp",
      status: "pending",
      companyId: params.companyId ?? null,
    });
  }

  await applySlaToConversation(conv!.id);
  await autoAssignConversation(conv!.id);
  await queueAiAssistancePlaceholder(conv!.id);

  if (params.customerId) {
    await recordJourneyEvent({
      customerId: params.customerId,
      eventType: "conversation_opened",
      title: "Conversation opened",
      metadata: { channel: params.channel },
      companyId: params.companyId,
      brandId: params.brandId,
    });
  }

  return conv!;
}

export async function appendMessage(params: {
  conversationId: number;
  channel: string;
  direction: "incoming" | "outgoing";
  message: string;
  attachments?: Array<{ type: string; url: string; name?: string }>;
  providerMessageId?: string | null;
  status?: "pending" | "sent" | "delivered" | "read" | "replied" | "failed";
  sender?: string | null;
  receiver?: string | null;
  senderUserId?: number | null;
  metadata?: Record<string, unknown>;
  companyId?: number | null;
}) {
  const [msg] = await db.insert(commConversationMessagesTable).values({
    conversationId: params.conversationId,
    channel: params.channel as "whatsapp",
    direction: params.direction,
    message: params.message,
    attachments: params.attachments ?? [],
    providerMessageId: params.providerMessageId ?? null,
    status: params.status ?? (params.direction === "outgoing" ? "sent" : "delivered"),
    sender: params.sender ?? null,
    receiver: params.receiver ?? null,
    senderUserId: params.senderUserId ?? null,
    metadata: params.metadata ?? {},
    companyId: params.companyId ?? null,
  }).returning();

  const preview = params.message.slice(0, 200);
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, params.conversationId)).limit(1);

  await db.update(commConversationsTable).set({
    lastMessageAt: new Date(),
    lastMessagePreview: preview,
    updatedAt: new Date(),
    status: params.direction === "incoming" && conv?.status === "closed" ? "open" : conv?.status,
  }).where(eq(commConversationsTable.id, params.conversationId));

  if (params.direction === "outgoing" && params.senderUserId) {
    await markFirstResponse(params.conversationId);
  }

  if (params.direction === "incoming") {
    await autoTagConversation(params.conversationId, params.message);
  }

  return msg!;
}

export async function replyToConversation(
  conversationId: number,
  userId: number,
  message: string,
  channel?: string,
) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);
  if (!conv) throw new Error("Conversation not found");

  const ch = channel ?? conv.primaryChannel;
  let phone: string | undefined;
  let email: string | undefined;

  if (conv.customerId) {
    const [c] = await db.select({ phone: customersTable.phone, email: customersTable.email })
      .from(customersTable).where(eq(customersTable.id, conv.customerId)).limit(1);
    phone = c?.phone ?? undefined;
    email = c?.email ?? undefined;
  } else if (conv.leadId) {
    const [l] = await db.select({ phone: leadsTable.phone })
      .from(leadsTable).where(eq(leadsTable.id, conv.leadId)).limit(1);
    phone = l?.phone ?? undefined;
  } else {
    phone = conv.unknownPhone ?? undefined;
    email = conv.unknownEmail ?? undefined;
  }

  const result = await sendViaChannel(ch as "whatsapp", {
    phone, email, message, companyId: conv.companyId, brandId: conv.brandId,
  });

  const msg = await appendMessage({
    conversationId,
    channel: ch,
    direction: "outgoing",
    message,
    status: result.success ? "sent" : "failed",
    senderUserId: userId,
    companyId: conv.companyId,
    metadata: { externalId: result.externalId, error: result.error },
  });

  await logCommAudit({
    action: "conversation.reply",
    resource: "conversation",
    resourceId: conversationId,
    userId,
    companyId: conv.companyId,
    brandId: conv.brandId,
    payload: { channel: ch, success: result.success },
  });

  if (conv.customerId) {
    const eventType = ch === "whatsapp" ? "whatsapp_sent" : ch === "sms" ? "sms_sent" : ch === "email" ? "email_sent" : "in_app_sent";
    await recordJourneyEvent({
      customerId: conv.customerId,
      eventType: eventType as "sms_sent",
      title: `Reply sent via ${ch}`,
      companyId: conv.companyId,
      brandId: conv.brandId,
    });
  }

  return { message: msg, sendResult: result };
}

export async function getConversationWithMessages(conversationId: number, messageLimit = 50) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);
  if (!conv) return null;

  const messages = await db.select().from(commConversationMessagesTable)
    .where(eq(commConversationMessagesTable.conversationId, conversationId))
    .orderBy(desc(commConversationMessagesTable.createdAt))
    .limit(messageLimit);

  const notes = await db.select().from(commConversationNotesTable)
    .where(eq(commConversationNotesTable.conversationId, conversationId))
    .orderBy(desc(commConversationNotesTable.createdAt));

  const tags = await db.select().from(commConversationTagsTable)
    .where(eq(commConversationTagsTable.conversationId, conversationId));

  return { ...conv, messages: messages.reverse(), notes, tags };
}

export async function closeConversation(conversationId: number, userId?: number) {
  const [conv] = await db.update(commConversationsTable).set({
    status: "closed",
    closedAt: new Date(),
    resolvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(commConversationsTable.id, conversationId)).returning();

  if (conv?.customerId) {
    await recordJourneyEvent({
      customerId: conv.customerId,
      eventType: "conversation_closed",
      title: "Conversation closed",
      companyId: conv.companyId,
      brandId: conv.brandId,
    });
  }

  await logCommAudit({
    action: "conversation.close",
    resource: "conversation",
    resourceId: conversationId,
    userId,
    companyId: conv?.companyId,
    brandId: conv?.brandId,
  });

  return conv;
}

export async function addInternalNote(
  conversationId: number,
  authorUserId: number,
  body: string,
  mentions: number[] = [],
) {
  const [conv] = await db.select().from(commConversationsTable)
    .where(eq(commConversationsTable.id, conversationId)).limit(1);

  const [note] = await db.insert(commConversationNotesTable).values({
    conversationId,
    authorUserId,
    body,
    mentions,
    companyId: conv?.companyId ?? null,
  }).returning();

  await logCommAudit({
    action: "conversation.note",
    resource: "conversation",
    resourceId: conversationId,
    userId: authorUserId,
    companyId: conv?.companyId,
    payload: { mentions },
  });

  return note!;
}

export async function resolveCustomerByPhone(phone: string, companyId?: number | null) {
  const normalized = phone.replace(/\D/g, "").slice(-10);
  const conditions = [sql`RIGHT(REGEXP_REPLACE(${customersTable.phone}, '[^0-9]', '', 'g'), 10) = ${normalized}`];
  if (companyId) conditions.push(eq(customersTable.companyId, companyId));

  const [customer] = await db.select().from(customersTable).where(and(...conditions)).limit(1);
  if (customer) return { customerId: customer.id, leadId: null as number | null };

  const leadConditions = [sql`RIGHT(REGEXP_REPLACE(${leadsTable.phone}, '[^0-9]', '', 'g'), 10) = ${normalized}`];
  if (companyId) leadConditions.push(eq(leadsTable.companyId, companyId));
  const [lead] = await db.select().from(leadsTable).where(and(...leadConditions)).limit(1);
  if (lead) return { customerId: lead.customerId, leadId: lead.id };

  return { customerId: null, leadId: null };
}
