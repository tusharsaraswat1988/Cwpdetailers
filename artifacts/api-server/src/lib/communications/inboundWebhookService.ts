/**
 * Inbound webhook processing — WhatsApp (Meta), SMS, Email
 */
import { db } from "@workspace/db";
import {
  commConversationMessagesTable, commConversationsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  findOrCreateConversation, appendMessage,
} from "./conversationService";
import { resolveOrCreateInboundContact } from "../inboundContact";
import { recordJourneyEvent } from "./journeyService";
import { refreshAiAssistance } from "./aiAssistanceService";
import { evaluateTicketRules } from "./ticketAutomationService";
import { logger } from "../logger";

type WaInboundMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string };
  document?: { id: string; filename?: string };
  location?: { latitude: number; longitude: number };
};

export function parseWhatsAppWebhook(payload: Record<string, unknown>) {
  const messages: WaInboundMessage[] = [];
  const statuses: Array<{ messageId: string; status: string }> = [];

  try {
    const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];
    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        if (!value) continue;

        const msgs = (value.messages as WaInboundMessage[]) ?? [];
        messages.push(...msgs);

        const sts = (value.statuses as Array<{ id: string; status: string }>) ?? [];
        for (const s of sts) {
          statuses.push({ messageId: s.id, status: s.status });
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "WhatsApp webhook parse error");
  }

  return { messages, statuses };
}

export async function processWhatsAppInbound(
  payload: Record<string, unknown>,
  companyId?: number | null,
) {
  const { messages, statuses } = parseWhatsAppWebhook(payload);
  const results: Array<{ type: string; id?: number | string }> = [];

  for (const status of statuses) {
    const mapped = status.status === "read" ? "read"
      : status.status === "delivered" ? "delivered"
      : status.status === "failed" ? "failed"
      : status.status === "sent" ? "sent" : null;
    if (!mapped) continue;

    await db.update(commConversationMessagesTable).set({
      status: mapped as "read",
    }).where(eq(commConversationMessagesTable.providerMessageId, status.messageId));

    results.push({ type: "status", id: status.messageId });
  }

  for (const msg of messages) {
    const phone = msg.from;
    let body = "";
    const attachments: Array<{ type: string; url: string; name?: string }> = [];

    switch (msg.type) {
      case "text":
        body = msg.text?.body ?? "";
        break;
      case "image":
        body = msg.image?.caption ?? "[Image]";
        attachments.push({ type: "image", url: msg.image?.id ?? "", name: "image" });
        break;
      case "document":
        body = `[Document: ${msg.document?.filename ?? "file"}]`;
        attachments.push({ type: "document", url: msg.document?.id ?? "", name: msg.document?.filename });
        break;
      case "location":
        body = `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
        attachments.push({ type: "location", url: `${msg.location?.latitude},${msg.location?.longitude}` });
        break;
      default:
        body = `[${msg.type} message]`;
    }

    const resolved = await resolveOrCreateInboundContact(phone, { companyId, channel: "whatsapp" });
    const conv = await findOrCreateConversation({
      customerId: resolved.customerId,
      leadId: resolved.leadId,
      channel: "whatsapp",
      phone,
      companyId,
      subject: body.slice(0, 100),
    });

    const saved = await appendMessage({
      conversationId: conv.id,
      channel: "whatsapp",
      direction: "incoming",
      message: body,
      attachments,
      providerMessageId: msg.id,
      status: "delivered",
      sender: phone,
      companyId,
    });

    if (resolved.customerId) {
      await recordJourneyEvent({
        customerId: resolved.customerId,
        eventType: "whatsapp_replied",
        title: "WhatsApp reply received",
        description: body.slice(0, 200),
        companyId,
      });
    }

    const recent = await db.select({ message: commConversationMessagesTable.message })
      .from(commConversationMessagesTable)
      .where(eq(commConversationMessagesTable.conversationId, conv.id))
      .limit(10);
    await refreshAiAssistance(conv.id, recent.map(r => r.message));
    await evaluateTicketRules(conv.id);

    results.push({ type: "message", id: saved.id });
  }

  return results;
}

export async function processSmsInbound(params: {
  phone: string;
  message: string;
  providerMessageId?: string;
  companyId?: number | null;
}) {
  const resolved = await resolveOrCreateInboundContact(params.phone, { companyId: params.companyId, channel: "sms" });
  const conv = await findOrCreateConversation({
    customerId: resolved.customerId,
    leadId: resolved.leadId,
    channel: "sms",
    phone: params.phone,
    companyId: params.companyId,
  });

  const saved = await appendMessage({
    conversationId: conv.id,
    channel: "sms",
    direction: "incoming",
    message: params.message,
    providerMessageId: params.providerMessageId,
    status: "delivered",
    sender: params.phone,
    companyId: params.companyId,
  });

  if (resolved.customerId) {
    await recordJourneyEvent({
      customerId: resolved.customerId,
      eventType: "sms_received",
      title: "SMS reply received",
      companyId: params.companyId,
    });
  }

  await evaluateTicketRules(conv.id);
  return saved;
}

export async function processEmailInbound(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  companyId?: number | null;
  customerId?: number | null;
}) {
  const conv = await findOrCreateConversation({
    customerId: params.customerId,
    channel: "email",
    email: params.from,
    emailThreadId: params.threadId ?? params.inReplyTo ?? `email-${params.from}`,
    companyId: params.companyId,
    subject: params.subject,
  });

  const saved = await appendMessage({
    conversationId: conv.id,
    channel: "email",
    direction: "incoming",
    message: params.body,
    sender: params.from,
    receiver: params.to,
    status: "delivered",
    metadata: { subject: params.subject, threadId: params.threadId },
    companyId: params.companyId,
  });

  if (params.customerId) {
    await recordJourneyEvent({
      customerId: params.customerId,
      eventType: "email_replied",
      title: `Email reply: ${params.subject}`,
      companyId: params.companyId,
    });
  }

  return saved;
}

export function verifyWhatsAppWebhook(mode: string, token: string, challenge: string) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "cwp_verify";
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}
