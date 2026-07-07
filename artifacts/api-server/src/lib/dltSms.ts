import type { SmsSendResult } from "./notifications/types";
import { normalizePhone } from "./notifications/types";

const FAST2SMS_BULK_URL = "https://www.fast2sms.com/dev/bulkV2";
const FAST2SMS_OTP_SEND_URL = "https://www.fast2sms.com/dev/otp/send";

export type SendOtpSmsOptions = {
  phone: string;
  recipientName: string;
  otpCode: string;
  otpExpiryMinutes?: number;
};

function sanitizeTemplateVar(value: string): string {
  return value.replace(/\|/g, " ").trim().slice(0, 40) || "Customer";
}

function getDltConfig() {
  return {
    apiKey: process.env.FAST2SMS_API_KEY ?? "",
    senderId: process.env.FAST2SMS_SENDER_ID ?? "CWPDTL",
    messageId:
      process.env.FAST2SMS_DLT_MESSAGE_ID
      ?? process.env.FAST2SMS_TEMPLATE_ID
      ?? process.env.FAST2SMS_DLT_TEMPLATE_ID
      ?? "",
    otpId: process.env.FAST2SMS_OTP_ID ?? "",
  };
}

async function postFast2Sms(url: string, apiKey: string, body: Record<string, unknown>): Promise<SmsSendResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      return?: boolean;
      request_id?: string;
      message?: string | string[];
      status_code?: number;
    };

    const ok = res.ok && data.return === true;
    return {
      success: ok,
      externalId: data.request_id,
      error: ok
        ? undefined
        : (Array.isArray(data.message) ? data.message.join(", ") : String(data.message ?? res.statusText)),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FAST2SMS request failed" };
  }
}

/** Send OTP using the approved Jio DLT template via Fast2SMS. */
export async function sendOtpSms(opts: SendOtpSmsOptions): Promise<SmsSendResult> {
  const phone = normalizePhone(opts.phone);
  if (!phone) return { success: false, error: "Invalid phone number" };

  const { apiKey, senderId, messageId, otpId } = getDltConfig();
  if (!apiKey) return { success: false, error: "FAST2SMS_API_KEY not configured" };

  const recipientName = sanitizeTemplateVar(opts.recipientName);
  const variablesValues = `${recipientName}|${opts.otpCode}`;
  const expiry = opts.otpExpiryMinutes ?? 15;

  if (otpId) {
    return postFast2Sms(FAST2SMS_OTP_SEND_URL, apiKey, {
      mobile: phone,
      otp_id: otpId,
      otp: opts.otpCode,
      variables_values: variablesValues,
      otp_expiry: expiry,
      otp_length: opts.otpCode.length,
    });
  }

  if (messageId) {
    return postFast2Sms(FAST2SMS_BULK_URL, apiKey, {
      route: "dlt",
      sender_id: senderId,
      message: messageId,
      variables_values: variablesValues,
      numbers: phone,
      flash: "0",
    });
  }

  return {
    success: false,
    error: "DLT SMS not configured. Set FAST2SMS_DLT_MESSAGE_ID or FAST2SMS_OTP_ID in .env",
  };
}

export function isOtpSmsConfigured(): boolean {
  const { apiKey, messageId, otpId } = getDltConfig();
  return Boolean(apiKey && (messageId || otpId));
}
