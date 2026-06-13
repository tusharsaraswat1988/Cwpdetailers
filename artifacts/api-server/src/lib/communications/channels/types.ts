/** Provider-independent channel contracts — campaign engine must use ChannelService only */

export type ChannelSendPayload = {
  phone?: string;
  email?: string;
  message: string;
  subject?: string;
  dltTemplateId?: string;
  senderId?: string;
  companyId?: number | null;
  brandId?: number | null;
  whatsappTemplateName?: string;
  whatsappTemplateLanguage?: string;
  whatsappVariables?: Record<string, string>;
  whatsappMessageType?: "template" | "text" | "utility" | "service";
  pushToken?: string;
  metadata?: Record<string, unknown>;
};

export type ChannelSendResult = {
  success: boolean;
  externalId?: string;
  error?: string;
  timelineEvents?: Array<{ type: string; at: string }>;
};

export interface SmsProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(payload: ChannelSendPayload): Promise<ChannelSendResult>;
}

export interface WhatsappProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(payload: ChannelSendPayload): Promise<ChannelSendResult>;
}

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(payload: ChannelSendPayload): Promise<ChannelSendResult>;
}

export interface PushProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(payload: ChannelSendPayload): Promise<ChannelSendResult>;
}

export type CommChannel = "sms" | "whatsapp" | "email" | "push" | "in_app";
