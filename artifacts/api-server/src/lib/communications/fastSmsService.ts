import { db } from "@workspace/db";
import { commProvidersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { Fast2SmsAdapter, type Fast2SmsConfig } from "../notifications/channels/sms";
import type { SmsSendResult } from "../notifications/types";

export type FastSmsSendOptions = {
  phone: string;
  message: string;
  dltTemplateId?: string;
  senderId?: string;
  companyId?: number | null;
  apiKey?: string;
};

export async function resolveFastSmsConfig(companyId?: number | null): Promise<Fast2SmsConfig> {
  const rows = await db.select().from(commProvidersTable)
    .where(and(
      eq(commProvidersTable.channel, "sms"),
      eq(commProvidersTable.providerType, "fast2sms"),
      eq(commProvidersTable.isActive, true),
    ))
    .orderBy(desc(commProvidersTable.isPrimary), desc(commProvidersTable.priority));

  const row = rows.find(r => !companyId || r.companyId === companyId) ?? rows[0];
  const config = (row?.config ?? {}) as Record<string, string>;

  return {
    apiKey: config.apiKey,
    senderId: config.senderId,
    templateId: config.templateId,
  };
}

export async function sendSms(opts: FastSmsSendOptions): Promise<SmsSendResult> {
  const dbConfig = await resolveFastSmsConfig(opts.companyId);
  const adapter = new Fast2SmsAdapter({
    apiKey: opts.apiKey || dbConfig.apiKey,
    senderId: opts.senderId || dbConfig.senderId,
    templateId: opts.dltTemplateId || dbConfig.templateId,
  });

  if (!adapter.isConfigured()) {
    return { success: false, error: "FastSMS not configured — add provider or FAST2SMS_API_KEY" };
  }

  return adapter.sendSms(opts.phone, opts.message, {
    dltTemplateId: opts.dltTemplateId || dbConfig.templateId,
    senderId: opts.senderId || dbConfig.senderId,
  });
}

export async function sendTemplateSms(opts: FastSmsSendOptions & { dltTemplateId: string }): Promise<SmsSendResult> {
  return sendSms(opts);
}

export async function sendBulkSms(
  phones: string[],
  message: string,
  opts: { dltTemplateId?: string; senderId?: string; companyId?: number | null; apiKey?: string } = {},
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
      apiKey: opts.apiKey,
    });
    results.push(result);
    if (result.success) sent++; else failed++;
  }

  return { sent, failed, results };
}
