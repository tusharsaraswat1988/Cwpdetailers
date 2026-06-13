import { db } from "@workspace/db";
import { commProvidersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { Fast2SmsAdapter } from "../notifications/channels/sms";
import type { SmsSendResult } from "../notifications/types";

export type FastSmsSendOptions = {
  phone: string;
  message: string;
  dltTemplateId?: string;
  senderId?: string;
  companyId?: number | null;
};

async function resolveFastSmsConfig(companyId?: number | null): Promise<Record<string, string>> {
  const rows = await db.select().from(commProvidersTable)
    .where(and(
      eq(commProvidersTable.channel, "sms"),
      eq(commProvidersTable.providerType, "fast2sms"),
      eq(commProvidersTable.isActive, true),
    ))
    .orderBy(desc(commProvidersTable.isPrimary), desc(commProvidersTable.priority));

  const row = rows.find(r => !companyId || r.companyId === companyId) ?? rows[0];
  const config = (row?.config ?? {}) as Record<string, string>;

  if (config.apiKey) process.env.FAST2SMS_API_KEY = config.apiKey;
  if (config.senderId) process.env.FAST2SMS_SENDER_ID = config.senderId;
  if (config.templateId) process.env.FAST2SMS_TEMPLATE_ID = config.templateId;

  return config;
}

export async function sendSms(opts: FastSmsSendOptions): Promise<SmsSendResult> {
  await resolveFastSmsConfig(opts.companyId);
  const adapter = new Fast2SmsAdapter();
  if (!adapter.isConfigured()) {
    return { success: false, error: "FastSMS not configured — add provider or FAST2SMS_API_KEY" };
  }
  if (opts.dltTemplateId) process.env.FAST2SMS_TEMPLATE_ID = opts.dltTemplateId;
  if (opts.senderId) process.env.FAST2SMS_SENDER_ID = opts.senderId;
  return adapter.sendSms(opts.phone, opts.message);
}

export async function sendTemplateSms(opts: FastSmsSendOptions & { dltTemplateId: string }): Promise<SmsSendResult> {
  return sendSms(opts);
}

export async function sendBulkSms(
  phones: string[],
  message: string,
  opts: { dltTemplateId?: string; senderId?: string; companyId?: number | null } = {},
): Promise<{ sent: number; failed: number; results: SmsSendResult[] }> {
  const results: SmsSendResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const phone of phones) {
    const result = await sendSms({
      phone,
      message,
      dltTemplateId: opts.dltTemplateId,
      senderId: opts.senderId,
      companyId: opts.companyId,
    });
    results.push(result);
    if (result.success) sent++; else failed++;
  }

  return { sent, failed, results };
}
