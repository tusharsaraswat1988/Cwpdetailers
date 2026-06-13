import type { SmsChannelAdapter, SmsSendResult } from "../types";

const FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2";

export class Fast2SmsAdapter implements SmsChannelAdapter {
  readonly name = "fast2sms";

  isConfigured(): boolean {
    return Boolean(process.env.FAST2SMS_API_KEY);
  }

  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      return { success: false, error: "FAST2SMS_API_KEY not configured" };
    }

    const senderId = process.env.FAST2SMS_SENDER_ID;
    const templateId = process.env.FAST2SMS_TEMPLATE_ID;

    try {
      const body: Record<string, string> = {
        route: templateId ? "dlt" : "q",
        message,
        numbers: phone,
        flash: "0",
      };
      if (senderId) body.sender_id = senderId;
      if (templateId) body.template_id = templateId;

      const res = await fetch(FAST2SMS_URL, {
        method: "POST",
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { return?: boolean; request_id?: string; message?: string | string[] };
      const ok = res.ok && data.return === true;
      return {
        success: ok,
        externalId: data.request_id,
        error: ok ? undefined : (Array.isArray(data.message) ? data.message.join(", ") : String(data.message ?? res.statusText)),
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "FAST2SMS request failed" };
    }
  }
}

/** Optional MSG91 adapter for future / dual-provider setups. */
export class Msg91Adapter implements SmsChannelAdapter {
  readonly name = "msg91";

  isConfigured(): boolean {
    return Boolean(process.env.MSG91_AUTH_KEY);
  }

  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    const authKey = process.env.MSG91_AUTH_KEY;
    const senderId = process.env.MSG91_SENDER_ID ?? "CWPCLN";
    if (!authKey) return { success: false, error: "MSG91_AUTH_KEY not configured" };

    try {
      const params = new URLSearchParams({
        authkey: authKey,
        mobiles: `91${phone}`,
        message,
        sender: senderId,
        route: "4",
        country: "91",
      });
      const res = await fetch(`https://api.msg91.com/api/sendhttp.php?${params}`);
      const text = await res.text();
      const ok = res.ok && !text.toLowerCase().includes("error");
      return { success: ok, externalId: text.trim(), error: ok ? undefined : text };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "MSG91 request failed" };
    }
  }
}

export function createDefaultSmsAdapter(): SmsChannelAdapter {
  const fast2sms = new Fast2SmsAdapter();
  if (fast2sms.isConfigured()) return fast2sms;
  const msg91 = new Msg91Adapter();
  if (msg91.isConfigured()) return msg91;
  return fast2sms;
}
