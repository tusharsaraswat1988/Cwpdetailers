export type NotificationChannel = "sms" | "email" | "whatsapp" | "in_app";

export type SmsSendResult = {
  success: boolean;
  externalId?: string;
  error?: string;
};

export interface SmsChannelAdapter {
  readonly name: string;
  isConfigured(): boolean;
  sendSms(phone: string, message: string): Promise<SmsSendResult>;
}

export interface EmailChannelAdapter {
  readonly name: string;
  isConfigured(): boolean;
  sendEmail(to: string, subject: string, body: string): Promise<SmsSendResult>;
}

export type ChannelAdapters = {
  sms?: SmsChannelAdapter;
  email?: EmailChannelAdapter;
  whatsapp?: SmsChannelAdapter;
};

export function getConfiguredSmsAdapter(adapters: ChannelAdapters): SmsChannelAdapter | null {
  if (adapters.sms?.isConfigured()) return adapters.sms;
  return null;
}

import { normalizeIndianMobile } from "@workspace/validation";

export function normalizePhone(phone: string): string | null {
  return normalizeIndianMobile(phone);
}

export type DispatchChannel = NotificationChannel;
