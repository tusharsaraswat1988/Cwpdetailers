async function commFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export type DltEntity = { id: number; name: string; entityId: string; isActive: boolean };
export type DltHeader = { id: number; entityId: number; headerId: string; name: string; isActive: boolean };
export type CommTemplate = {
  id: number; name: string; channel: string; category: string;
  dltTemplateId?: string; headerId?: number; subject?: string; body: string;
  variables?: string[]; isActive: boolean;
};
export type CommProvider = {
  id: number; name: string; providerType: string; channel: string;
  isActive: boolean; isPrimary: boolean; priority: number; configKeys?: string[];
};
export type AudienceFilter = { id: string; label: string; group: string; params?: Array<{ key: string; type: string; default: number }> };
export type AudienceFilterNode =
  | { type: "filter"; filter: string; params?: Record<string, unknown> }
  | { type: "smart_segment"; segmentKey: string }
  | { type: "group"; operator: "AND" | "OR"; children: AudienceFilterNode[] };
export type CommAudience = { id: number; name: string; description?: string; filterDefinition: AudienceFilterNode; estimatedCount?: number };
export type CommCampaign = {
  id: number; name: string; channel: string; audienceId?: number; templateId?: number;
  status: string; scheduledAt?: string; sentAt?: string; costAmount?: string;
  stats?: {
    sent?: number; delivered?: number; read?: number; failed?: number;
    clicked?: number; converted?: number; revenue?: number;
    consentBlocked?: number; bookingsGenerated?: number; invoicesGenerated?: number; roi?: number;
  };
};
export type CommAutomation = {
  id: number; name: string; trigger: string; channel: string; templateId: number;
  isActive: boolean; delayMinutes: number;
};
export type CommEvent = {
  id: number; channel: string; renderedBody: string; status: string;
  sentAt?: string; customerId?: number; leadId?: number; createdAt: string;
  metadata?: { timelineEvents?: Array<{ type: string; at: string }>; reason?: string };
};
export type CommBrand = {
  id: number; name: string; code: string; status: string;
  primaryColor?: string; logo?: string;
  emailSender?: string; defaultSmsHeader?: string; defaultWhatsappNumber?: string;
};
export type CommWorkflow = {
  id: number; name: string; brandId: number; trigger: string; isActive: boolean;
  steps?: Array<{ id: number; stepOrder: number; stepType: string; config?: Record<string, unknown> }>;
};
export type CommEmailTemplate = {
  id: number; brandId: number; name: string; subject: string; htmlContent: string; emailType: string;
};
export type CommWhatsappTemplate = {
  id: number; brandId: number; metaTemplateName: string; category: string; bodyPreview: string;
};
export type CommConversation = {
  id: number; status: string; primaryChannel: string;
  subject?: string; lastMessagePreview?: string; slaStatus?: string;
  customerId?: number; assignedToUserId?: number; assignedTeamId?: number;
  lastMessageAt?: string; createdAt: string;
};
export type CommConversationDetail = CommConversation & {
  messages: Array<{ id: number; direction: string; message: string; status: string; channel: string; createdAt: string }>;
  notes: Array<{ id: number; body: string; authorUserId: number; createdAt: string }>;
  tags: Array<{ id: number; tag: string; source: string }>;
};
export type CommAiAssistance = {
  summary?: string; sentiment?: string; intent?: string; priority?: string;
  replySuggestions?: string[];
};
export type CommConsent = {
  customerId: number;
  smsConsent: boolean;
  whatsappConsent: boolean;
  emailConsent: boolean;
  pushConsent?: boolean;
  consentSource?: string;
  consentDate?: string;
  birthDate?: string;
  anniversaryDate?: string;
};
export type SmartSegment = {
  id: number; name: string; description?: string; segmentKey: string;
  configJson: AudienceFilterNode; isSystem: boolean; active: boolean;
};
export type CommAnalytics = {
  sent: number; delivered: number; read: number; failed: number;
  clicked: number; converted: number; revenue: number;
  consentBlocked: number; consentRate: number;
  totalCampaigns: number; activeAutomations: number; roi: number;
  byChannel: Record<string, { sent: number; failed: number; delivered: number }>;
  dailyTrend: Array<{ date: string; sent: number; failed: number; revenue: number }>;
  channelPerformance: Array<{ channel: string; sent: number; failed: number; revenue: number }>;
  campaignRoi: Array<{ campaignId: number; name: string; revenue: number; cost: number; roi: number }>;
  sprint1?: { sentToday: number; failedToday: number; campaignCount: number; templateCount: number };
};
export type CampaignDetail = CommCampaign & {
  roi: number | null;
  attribution: {
    attributions: Array<{ id: number; customerId: number; bookingId?: number; invoiceId?: number; revenueAmount: string }>;
    summary: { customers: number; bookings: number; invoices: number; revenue: number };
  };
};

export const commApi = {
  getAnalytics: (days = 30) => commFetch<CommAnalytics>(`/communications/dashboard?days=${days}`),
  getHistory: (limit = 200) => commFetch<CommEvent[]>(`/communications/history?limit=${limit}`),
  getDlt: () => commFetch<{ entities: DltEntity[]; headers: DltHeader[]; templates: unknown[] }>("/communications/dlt"),
  deleteTemplate: (id: number) => commFetch<{ ok: boolean }>(`/communications/templates/${id}`, { method: "DELETE" }),
  deleteAudience: (id: number) => commFetch<{ ok: boolean }>(`/communications/audiences/${id}`, { method: "DELETE" }),
  deleteCampaign: (id: number) => commFetch<{ ok: boolean }>(`/communications/campaigns/${id}`, { method: "DELETE" }),
  deleteProvider: (id: number) => commFetch<{ ok: boolean }>(`/communications/providers/${id}`, { method: "DELETE" }),
  getDltEntities: () => commFetch<DltEntity[]>("/communications/dlt/entities"),
  createDltEntity: (data: Partial<DltEntity>) => commFetch<DltEntity>("/communications/dlt/entities", { method: "POST", body: JSON.stringify(data) }),
  getDltHeaders: () => commFetch<DltHeader[]>("/communications/dlt/headers"),
  createDltHeader: (data: Partial<DltHeader>) => commFetch<DltHeader>("/communications/dlt/headers", { method: "POST", body: JSON.stringify(data) }),
  getTemplates: () => commFetch<CommTemplate[]>("/communications/templates"),
  createTemplate: (data: Partial<CommTemplate>) => commFetch<CommTemplate>("/communications/templates", { method: "POST", body: JSON.stringify(data) }),
  getProviders: () => commFetch<CommProvider[]>("/communications/providers"),
  createProvider: (data: Partial<CommProvider & { config?: Record<string, string> }>) =>
    commFetch<CommProvider>("/communications/providers", { method: "POST", body: JSON.stringify(data) }),
  getAudienceFilters: () => commFetch<AudienceFilter[]>("/communications/audience-filters"),
  getAudiences: () => commFetch<CommAudience[]>("/communications/audiences"),
  createAudience: (data: { name: string; description?: string; filterDefinition: AudienceFilterNode }) =>
    commFetch<CommAudience>("/communications/audiences", { method: "POST", body: JSON.stringify(data) }),
  previewAudience: (filterDefinition: AudienceFilterNode) =>
    commFetch<{ count: number; sample: Array<{ customerName?: string; phone?: string }> }>(
      "/communications/audiences/preview", { method: "POST", body: JSON.stringify({ filterDefinition }) },
    ),
  getSmartSegments: () => commFetch<SmartSegment[]>("/communications/smart-segments"),
  previewSmartSegment: (segmentKey: string, combineWith?: AudienceFilterNode) =>
    commFetch<{ count: number; sample: Array<{ customerName?: string; phone?: string }> }>(
      "/communications/smart-segments/preview", { method: "POST", body: JSON.stringify({ segmentKey, combineWith }) },
    ),
  getCampaigns: () => commFetch<CommCampaign[]>("/communications/campaigns"),
  getCampaignDetail: (id: number) => commFetch<CampaignDetail>(`/communications/campaigns/${id}`),
  createCampaign: (data: Partial<CommCampaign & { scheduledAt?: string }>) =>
    commFetch<CommCampaign>("/communications/campaigns", { method: "POST", body: JSON.stringify(data) }),
  sendCampaign: (id: number) => commFetch<{ sent: number; failed: number; consentBlocked?: number; stats: CommCampaign["stats"] }>(
    `/communications/campaigns/${id}/send`, { method: "POST" },
  ),
  scheduleCampaign: (id: number, scheduledAt: string) =>
    commFetch<CommCampaign>(`/communications/campaigns/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
  previewMessage: (templateBody: string) =>
    commFetch<{ body: string }>("/communications/campaigns/preview", { method: "POST", body: JSON.stringify({ templateBody }) }),
  testWhatsApp: (data: { phone: string; templateBody: string; templateName?: string }) =>
    commFetch<{ success: boolean; renderedMessage?: string; error?: string }>(
      "/communications/whatsapp/test-send", { method: "POST", body: JSON.stringify(data) },
    ),
  getAutomations: () => commFetch<CommAutomation[]>("/communications/automations"),
  createAutomation: (data: Partial<CommAutomation>) =>
    commFetch<CommAutomation>("/communications/automations", { method: "POST", body: JSON.stringify(data) }),
  getAutomationTriggers: () => commFetch<Array<{ id: string; label: string }>>("/communications/automation-triggers"),
  getTimeline: (customerId?: number) =>
    commFetch<CommEvent[]>(`/communications/timeline${customerId ? `?customerId=${customerId}` : ""}`),
  getTemplateVariables: () => commFetch<Array<{ key: string; placeholder: string }>>("/communications/template-variables"),
  getConsent: (customerId: number) => commFetch<CommConsent>(`/communications/consents/${customerId}`),
  updateConsent: (customerId: number, data: Partial<CommConsent>) =>
    commFetch<CommConsent>(`/communications/consents/${customerId}`, { method: "PUT", body: JSON.stringify(data) }),
  processJobs: () => commFetch<{ processed: number }>("/communications/jobs/process", { method: "POST" }),
  getBrands: () => commFetch<CommBrand[]>("/communications/brands"),
  getDltGovernanceTemplates: (brandId?: number) =>
    commFetch<Array<{ id: number; name: string; templateId: string; templateType: string; status: string }>>(
      `/communications/dlt/templates${brandId ? `?brandId=${brandId}` : ""}`,
    ),
  getEmailTemplates: (brandId?: number) =>
    commFetch<CommEmailTemplate[]>(`/communications/email/templates${brandId ? `?brandId=${brandId}` : ""}`),
  getWhatsappTemplates: (brandId?: number) =>
    commFetch<CommWhatsappTemplate[]>(`/communications/whatsapp/templates${brandId ? `?brandId=${brandId}` : ""}`),
  getWorkflows: (brandId?: number) =>
    commFetch<CommWorkflow[]>(`/communications/workflows${brandId ? `?brandId=${brandId}` : ""}`),
  getWorkflow: (id: number) => commFetch<CommWorkflow>(`/communications/workflows/${id}`),
  createWorkflow: (data: { brandId: number; name: string; trigger: string; steps?: Array<{ stepOrder: number; stepType: string; config?: Record<string, unknown> }> }) =>
    commFetch<CommWorkflow>("/communications/workflows", { method: "POST", body: JSON.stringify(data) }),
  getCustomerTimeline: (customerId: number, opts?: { brandId?: number; cursor?: number }) =>
    commFetch<{ items: CommEvent[]; nextCursor: number | null; hasMore: boolean }>(
      `/communications/timeline/customer/${customerId}${opts?.brandId ? `?brandId=${opts.brandId}` : ""}${opts?.cursor ? `${opts?.brandId ? "&" : "?"}cursor=${opts.cursor}` : ""}`,
    ),
  getQueueStats: () => commFetch<{ queued?: number; retrying?: number; deadLetter?: number }>("/communications/queue/stats"),
  getConsentHistory: (customerId: number) =>
    commFetch<Array<{ id: number; smsConsent?: boolean; whatsappConsent?: boolean; emailConsent?: boolean; pushConsent?: boolean; createdAt: string }>>(
      `/communications/consents/${customerId}/history`,
    ),
  getInboxCounts: () => commFetch<{
    open: number; assigned: number; unassigned: number; escalated: number;
    closed: number; unknown: number; myQueue: number; pendingReplies: number; slaBreaches: number;
  }>("/communications/inbox/counts"),
  getInbox: (filter = "all", cursor?: number) =>
    commFetch<{ items: CommConversation[]; nextCursor: number | null; hasMore: boolean }>(
      `/communications/inbox?filter=${filter}${cursor ? `&cursor=${cursor}` : ""}`,
    ),
  getConversation: (id: number) => commFetch<CommConversationDetail>(`/communications/conversations/${id}`),
  replyToConversation: (id: number, message: string, channel?: string) =>
    commFetch<{ message: unknown; sendResult: { success: boolean } }>(
      `/communications/conversations/${id}/reply`, { method: "POST", body: JSON.stringify({ message, channel }) },
    ),
  closeConversation: (id: number) =>
    commFetch<{ conversation: CommConversation; csatSurvey: unknown }>(
      `/communications/conversations/${id}/close`, { method: "POST" },
    ),
  getConversationAi: (id: number) => commFetch<CommAiAssistance | null>(`/communications/conversations/${id}/ai`),
  getCustomerJourney: (customerId: number, opts?: { sync?: boolean; cursor?: number }) =>
    commFetch<{ items: Array<{ id: string; source: string; title: string; occurredAt: string }>; nextCursor: number | null }>(
      `/communications/journey/customer/${customerId}${opts?.sync ? "?sync=true" : ""}${opts?.cursor ? `${opts?.sync ? "&" : "?"}cursor=${opts.cursor}` : ""}`,
    ),
  getCrmAnalytics: () => commFetch<{ inbox: unknown; sla: unknown; csat: unknown }>("/communications/crm/analytics"),
  getSlaDashboard: () => commFetch<{ openConversations: number; pendingReplies: number; slaBreaches: number }>("/communications/sla/dashboard"),
  getCsatDashboard: () => commFetch<{ totalResponses: number; avgRating: number; satisfactionPct: number }>("/communications/csat/dashboard"),
  getKnowledgeBase: (category?: string) =>
    commFetch<Array<{ id: number; title: string; category: string; content: string }>>(
      `/communications/knowledge-base${category ? `?category=${category}` : ""}`,
    ),
  getProfitability: (opts?: { brandId?: number; campaignId?: number }) =>
    commFetch<Array<{ channel: string; cost: number; revenue: number; profit: number; roi: number }>>(
      `/communications/profitability${opts?.brandId ? `?brandId=${opts.brandId}` : ""}${opts?.campaignId ? `${opts?.brandId ? "&" : "?"}campaignId=${opts.campaignId}` : ""}`,
    ),
};
