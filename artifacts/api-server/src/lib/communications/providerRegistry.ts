import { db } from "@workspace/db";
import { commProvidersTable, type CommProvider } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { Fast2SmsAdapter, Msg91Adapter } from "../notifications/channels/sms";
import type { SmsChannelAdapter, SmsSendResult, EmailChannelAdapter } from "../notifications/types";

import { createWhatsAppProvider } from "./providers/whatsappProvider";

export type SendOptions = {
  phone?: string;
  email?: string;
  message: string;
  subject?: string;
  dltTemplateId?: string;
  senderId?: string;
  companyId?: number | null;
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
  whatsappVariables?: Record<string, string>;
  whatsappMessageType?: "template" | "text" | "utility" | "service";
};

export interface CommChannelProvider {
  readonly name: string;
  readonly channel: string;
  isConfigured(): boolean;
  send(opts: SendOptions): Promise<SmsSendResult>;
}

class DbSmsProvider implements CommChannelProvider {
  constructor(
    readonly name: string,
    private adapter: SmsChannelAdapter,
    private config: Record<string, string>,
  ) {}

  readonly channel = "sms";

  isConfigured(): boolean {
    return this.adapter.isConfigured() || Object.keys(this.config).length > 0;
  }

  async send(opts: SendOptions): Promise<SmsSendResult> {
    if (!opts.phone) return { success: false, error: "No phone number" };
    return this.adapter.sendSms(opts.phone, opts.message);
  }
}

class StubEmailProvider implements CommChannelProvider {
  readonly name: string;
  readonly channel = "email";

  constructor(name: string, private config: Record<string, string>) {
    this.name = name;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey ?? process.env.RESEND_API_KEY);
  }

  async send(opts: SendOptions): Promise<SmsSendResult> {
    if (!opts.email) return { success: false, error: "No email address" };
    const apiKey = this.config.apiKey ?? process.env.RESEND_API_KEY;
    if (!apiKey) return { success: false, error: "Email provider not configured" };

    try {
      const { getBrandName } = await import("../brandIdentityService");
      const brandName = await getBrandName();
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.config.from ?? `${brandName} <noreply@cwpdetailers.com>`,
          to: [opts.email],
          subject: opts.subject ?? brandName,
          html: opts.message,
        }),
      });
      const data = (await res.json()) as { id?: string; message?: string };
      return { success: res.ok, externalId: data.id, error: res.ok ? undefined : data.message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Email send failed" };
    }
  }
}

class SmtpEmailProvider implements CommChannelProvider {
  readonly name: string;
  readonly channel = "email";

  constructor(name: string, private config: Record<string, string>) {
    this.name = name;
  }

  isConfigured(): boolean {
    return Boolean(this.config.host && this.config.user);
  }

  async send(opts: SendOptions): Promise<SmsSendResult> {
    if (!opts.email) return { success: false, error: "No email address" };
    // SMTP relay via configured host — use Resend when SMTP transport is not provisioned
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      return new StubEmailProvider(`${this.name}_resend_fallback`, { apiKey: resendKey, from: this.config.from }).send(opts);
    }
    return { success: false, error: "SMTP not configured — set host/user or RESEND_API_KEY" };
  }
}

class WhatsAppProviderAdapter implements CommChannelProvider {
  readonly name: string;
  readonly channel = "whatsapp";
  private provider: ReturnType<typeof createWhatsAppProvider>;

  constructor(name: string, config: Record<string, string>) {
    this.name = name;
    this.provider = createWhatsAppProvider(config);
  }

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  async send(opts: SendOptions): Promise<SmsSendResult> {
    if (!opts.phone) return { success: false, error: "No phone number" };
    return this.provider.send({
      phone: opts.phone,
      message: opts.message,
      messageType: opts.whatsappMessageType ?? (opts.whatsappTemplateName ? "template" : "text"),
      templateName: opts.whatsappTemplateName ?? opts.dltTemplateId,
      templateLanguage: opts.whatsappTemplateLanguage ?? "en",
      templateVariables: opts.whatsappVariables,
    });
  }
}

class InAppProvider implements CommChannelProvider {
  readonly name = "in_app";
  readonly channel = "in_app";

  isConfigured(): boolean {
    return true;
  }

  async send(_opts: SendOptions): Promise<SmsSendResult> {
    return { success: true, externalId: "in_app" };
  }
}

class PushProvider implements CommChannelProvider {
  readonly name: string;
  readonly channel = "push";

  constructor(name: string, private config: Record<string, string>) {
    this.name = name;
  }

  isConfigured(): boolean {
    return Boolean(this.config.serverKey ?? process.env.FCM_SERVER_KEY);
  }

  async send(_opts: SendOptions): Promise<SmsSendResult> {
    return { success: false, error: "Push notifications require device token registration (future)" };
  }
}

function adapterFromDbRow(row: CommProvider): CommChannelProvider | null {
  const config = (row.config ?? {}) as Record<string, string>;

  switch (row.providerType) {
    case "fast2sms": {
      if (config.apiKey) process.env.FAST2SMS_API_KEY = config.apiKey;
      if (config.senderId) process.env.FAST2SMS_SENDER_ID = config.senderId;
      if (config.templateId) process.env.FAST2SMS_TEMPLATE_ID = config.templateId;
      return new DbSmsProvider(row.name, new Fast2SmsAdapter(), config);
    }
    case "msg91": {
      if (config.authKey) process.env.MSG91_AUTH_KEY = config.authKey;
      if (config.senderId) process.env.MSG91_SENDER_ID = config.senderId;
      return new DbSmsProvider(row.name, new Msg91Adapter(), config);
    }
    case "resend":
      return new StubEmailProvider(row.name, config);
    case "smtp":
      return new SmtpEmailProvider(row.name, config);
    case "whatsapp_business":
      return new WhatsAppProviderAdapter(row.name, config);
    case "firebase":
      return new PushProvider(row.name, config);
    default:
      return null;
  }
}

export async function getProviderForChannel(
  channel: string,
  companyId?: number | null,
): Promise<CommChannelProvider | null> {
  if (channel === "in_app") return new InAppProvider();

  const conditions = [
    eq(commProvidersTable.channel, channel as "sms"),
    eq(commProvidersTable.isActive, true),
  ];
  if (companyId) conditions.push(eq(commProvidersTable.companyId, companyId));

  const rows = await db.select().from(commProvidersTable)
    .where(and(...conditions))
    .orderBy(desc(commProvidersTable.isPrimary), desc(commProvidersTable.priority));

  for (const row of rows) {
    const provider = adapterFromDbRow(row);
    if (provider?.isConfigured()) return provider;
  }

  if (channel === "sms") {
    const fallback = new Fast2SmsAdapter();
    if (fallback.isConfigured()) return new DbSmsProvider("env_fast2sms", fallback, {});
    const msg91 = new Msg91Adapter();
    if (msg91.isConfigured()) return new DbSmsProvider("env_msg91", msg91, {});
  }

  if (channel === "whatsapp") {
    const wa = createWhatsAppProvider({});
    if (wa.isConfigured()) return new WhatsAppProviderAdapter("env_whatsapp", {});
  }

  return null;
}

export async function sendViaProvider(
  channel: string,
  opts: SendOptions,
  companyId?: number | null,
): Promise<SmsSendResult> {
  const provider = await getProviderForChannel(channel, companyId);
  if (!provider) return { success: false, error: `No configured provider for ${channel}` };
  return provider.send(opts);
}
