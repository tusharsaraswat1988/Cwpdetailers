import type { SmsSendResult } from "../../notifications/types";

export type WhatsAppMessageType = "template" | "text" | "utility" | "service";

export type WhatsAppSendOptions = {
  phone: string;
  message?: string;
  messageType?: WhatsAppMessageType;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  accessToken?: string;
  phoneNumberId?: string;
};

type TimelineEvent = { type: string; at: string };

export type WhatsAppSendResult = SmsSendResult & {
  timelineEvents?: TimelineEvent[];
};

const GRAPH_API = "https://graph.facebook.com/v21.0";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildTemplateComponents(vars: Record<string, string>) {
  const bodyParams = Object.values(vars).map(text => ({ type: "text", text }));
  if (!bodyParams.length) return [];
  return [{ type: "body", parameters: bodyParams }];
}

export class WhatsAppBusinessProvider {
  readonly name = "whatsapp_business";
  readonly channel = "whatsapp";

  constructor(private config: Record<string, string> = {}) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN,
    ) && Boolean(
      this.config.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID,
    );
  }

  async send(opts: WhatsAppSendOptions): Promise<WhatsAppSendResult> {
    const token = opts.accessToken ?? this.config.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = opts.phoneNumberId ?? this.config.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      return { success: false, error: "WhatsApp provider not configured", timelineEvents: [{ type: "whatsapp_failed", at: new Date().toISOString() }] };
    }

    const to = normalizePhone(opts.phone);
    const messageType = opts.messageType ?? (opts.templateName ? "template" : "text");
    const timeline: TimelineEvent[] = [];

    try {
      let body: Record<string, unknown>;

      if (messageType === "template" && opts.templateName) {
        body = {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: opts.templateName,
            language: { code: opts.templateLanguage ?? "en" },
            components: buildTemplateComponents(opts.templateVariables ?? {}),
          },
        };
      } else if (messageType === "utility" || messageType === "service") {
        body = {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: {
            body: opts.message ?? "",
            preview_url: false,
          },
        };
      } else {
        body = {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: opts.message ?? "" },
        };
      }

      const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message: string; code?: number };
      };

      const ok = res.ok && Boolean(data.messages?.[0]?.id);
      const now = new Date().toISOString();

      if (ok) {
        timeline.push({ type: "whatsapp_sent", at: now });
        timeline.push({ type: "whatsapp_delivered", at: now });
      } else {
        timeline.push({ type: "whatsapp_failed", at: now });
      }

      return {
        success: ok,
        externalId: data.messages?.[0]?.id,
        error: ok ? undefined : data.error?.message ?? "WhatsApp send failed",
        timelineEvents: timeline,
      };
    } catch (err) {
      timeline.push({ type: "whatsapp_failed", at: new Date().toISOString() });
      return {
        success: false,
        error: err instanceof Error ? err.message : "WhatsApp request failed",
        timelineEvents: timeline,
      };
    }
  }

  /** Mark message as read via webhook handler (call from webhook route) */
  static parseWebhookStatus(payload: Record<string, unknown>): { messageId: string; status: "delivered" | "read" | "failed" } | null {
    try {
      const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
      const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
      const value = changes?.value as Record<string, unknown> | undefined;
      const statuses = value?.statuses as Array<Record<string, string>> | undefined;
      const status = statuses?.[0];
      if (!status?.id) return null;

      const mapped = status.status === "read" ? "read"
        : status.status === "delivered" ? "delivered"
        : status.status === "failed" ? "failed" : null;
      if (!mapped) return null;
      return { messageId: status.id, status: mapped };
    } catch {
      return null;
    }
  }
}

export function createWhatsAppProvider(config: Record<string, string> = {}): WhatsAppBusinessProvider {
  return new WhatsAppBusinessProvider(config);
}
