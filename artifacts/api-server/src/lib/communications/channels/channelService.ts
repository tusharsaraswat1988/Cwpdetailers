/**
 * Channel abstraction layer — Campaign → ChannelService → Provider Adapter → Provider
 * Campaign engine must never call providers directly.
 */
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { getProviderForChannel, type SendOptions } from "../providerRegistry";
import type { ChannelSendPayload, ChannelSendResult, CommChannel } from "./types";

function toLegacyOpts(payload: ChannelSendPayload): SendOptions {
  return {
    phone: payload.phone,
    email: payload.email,
    message: payload.message,
    subject: payload.subject,
    dltTemplateId: payload.dltTemplateId,
    senderId: payload.senderId,
    companyId: payload.companyId,
    whatsappTemplateName: payload.whatsappTemplateName,
    whatsappTemplateLanguage: payload.whatsappTemplateLanguage,
    whatsappVariables: payload.whatsappVariables,
    whatsappMessageType: payload.whatsappMessageType,
  };
}

async function sendInApp(payload: ChannelSendPayload): Promise<ChannelSendResult> {
  const userId = payload.metadata?.userId as number | undefined;
  if (!userId) return { success: false, error: "No userId for in-app notification" };
  await db.insert(notificationsTable).values({
    userId,
    title: payload.subject ?? "Notification",
    message: payload.message,
    type: "broadcast",
    channel: "in_app",
    deliveryStatus: "sent",
    companyId: payload.companyId,
  });
  return { success: true, externalId: "in_app" };
}

export async function sendViaChannel(
  channel: CommChannel,
  payload: ChannelSendPayload,
): Promise<ChannelSendResult> {
  if (channel === "in_app") return sendInApp(payload);

  const provider = await getProviderForChannel(channel, payload.companyId);
  if (!provider) return { success: false, error: `No configured provider for ${channel}` };

  const result = await provider.send(toLegacyOpts(payload));
  return {
    success: result.success,
    externalId: result.externalId,
    error: result.error,
  };
}

export async function isChannelConfigured(
  channel: CommChannel,
  companyId?: number | null,
): Promise<boolean> {
  if (channel === "in_app") return true;
  const provider = await getProviderForChannel(channel, companyId);
  return provider?.isConfigured() ?? false;
}
