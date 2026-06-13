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
  | { type: "group"; operator: "AND" | "OR"; children: AudienceFilterNode[] };
export type CommAudience = { id: number; name: string; description?: string; filterDefinition: AudienceFilterNode; estimatedCount?: number };
export type CommCampaign = {
  id: number; name: string; channel: string; audienceId?: number; templateId?: number;
  status: string; scheduledAt?: string; sentAt?: string;
  stats?: { sent?: number; delivered?: number; read?: number; failed?: number; clicked?: number; converted?: number; revenue?: number };
};
export type CommAutomation = {
  id: number; name: string; trigger: string; channel: string; templateId: number;
  isActive: boolean; delayMinutes: number;
};
export type CommEvent = {
  id: number; channel: string; renderedBody: string; status: string;
  sentAt?: string; customerId?: number; leadId?: number; createdAt: string;
};
export type CommAnalytics = {
  sent: number; delivered: number; read: number; failed: number;
  clicked: number; converted: number; revenue: number;
  byChannel: Record<string, { sent: number; failed: number }>;
  dailyTrend: Array<{ date: string; sent: number; failed: number }>;
};

export const commApi = {
  getAnalytics: (days = 30) => commFetch<CommAnalytics>(`/communications/analytics?days=${days}`),
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
  getCampaigns: () => commFetch<CommCampaign[]>("/communications/campaigns"),
  createCampaign: (data: Partial<CommCampaign & { scheduledAt?: string }>) =>
    commFetch<CommCampaign>("/communications/campaigns", { method: "POST", body: JSON.stringify(data) }),
  sendCampaign: (id: number) => commFetch<{ sent: number; failed: number; stats: CommCampaign["stats"] }>(
    `/communications/campaigns/${id}/send`, { method: "POST" },
  ),
  scheduleCampaign: (id: number, scheduledAt: string) =>
    commFetch<CommCampaign>(`/communications/campaigns/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
  previewMessage: (templateBody: string) =>
    commFetch<{ body: string }>("/communications/campaigns/preview", { method: "POST", body: JSON.stringify({ templateBody }) }),
  getAutomations: () => commFetch<CommAutomation[]>("/communications/automations"),
  createAutomation: (data: Partial<CommAutomation>) =>
    commFetch<CommAutomation>("/communications/automations", { method: "POST", body: JSON.stringify(data) }),
  getAutomationTriggers: () => commFetch<Array<{ id: string; label: string }>>("/communications/automation-triggers"),
  getTimeline: (customerId?: number) =>
    commFetch<CommEvent[]>(`/communications/timeline${customerId ? `?customerId=${customerId}` : ""}`),
  getTemplateVariables: () => commFetch<Array<{ key: string; placeholder: string }>>("/communications/template-variables"),
  processJobs: () => commFetch<{ processed: number }>("/communications/jobs/process", { method: "POST" }),
};
