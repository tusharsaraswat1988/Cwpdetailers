export type VisitFeedback = {
  id: number;
  visitId: number;
  subscriptionId?: number | null;
  customerId: number;
  staffId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  ratingScore: number;
  comment?: string | null;
  tags?: string[];
  issueReported?: boolean;
  complaintId?: number | null;
  createdAt: string;
};

export type QualityAnalytics = {
  operational: {
    totalVisits: number;
    completedVisits: number;
    cnaVisits: number;
    missedVisits: number;
    completionRate: number;
    cnaRate: number;
    missedRate: number;
    recleanRate: number;
    recleanCount: number;
    complaintsPer100Visits: number;
    totalComplaints: number;
    slaComplianceRate: number;
    avgResolutionHours: number;
  };
  ratings: {
    average: number;
    totalCount: number;
    distribution: Record<number, number>;
  };
  retention: {
    totalSubscriptions: number;
    activeSubscriptions: number;
    pausedSubscriptions: number;
    cancelledSubscriptions: number;
    completedSubscriptions: number;
    retentionRate: number;
    churnRate: number;
    expiringCount: number;
    cancellationReasons: Array<{ reason: string; count: number }>;
  };
  staffScorecard: Array<{
    staffId: number;
    name: string;
    phone: string;
    assignedVisits: number;
    completedVisits: number;
    cnaVisits: number;
    completionRate: number;
    productivityIndex: number;
    avgRating: number | null;
    feedbackCount: number;
  }>;
};

export type SlaPolicy = {
  id: number;
  name: string;
  cityId?: number | null;
  serviceType?: string | null;
  category: string;
  priority: string;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  pauseOnCustomerResponse: boolean;
  escalationLevel1Minutes?: number | null;
  escalationLevel2Minutes?: number | null;
  isActive: boolean;
};

export const qualityApi = {
  async submitVisitFeedback(
    visitId: number,
    data: {
      customerId?: number;
      ratingScore: number;
      comment?: string;
      tags?: string[];
      issueReported?: boolean;
    }
  ): Promise<{ success: boolean; feedbackId: number; isNegative: boolean; complaintId?: number }> {
    const res = await fetch(`/api/visits/${visitId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to submit feedback");
    }
    return res.json();
  },

  async getPendingFeedback(customerId?: number): Promise<{ data: any[] }> {
    const q = customerId ? `?customerId=${customerId}` : "";
    const res = await fetch(`/api/customer/pending-feedback${q}`, { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load pending feedback");
    }
    return res.json();
  },

  async getQualityAnalytics(params: {
    cityId?: number;
    branchId?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<QualityAnalytics> {
    const q = new URLSearchParams();
    if (params.cityId) q.set("cityId", String(params.cityId));
    if (params.branchId) q.set("branchId", String(params.branchId));
    if (params.startDate) q.set("startDate", params.startDate);
    if (params.endDate) q.set("endDate", params.endDate);

    const res = await fetch(`/api/quality/analytics?${q.toString()}`, { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load quality analytics");
    }
    return res.json();
  },

  async getSupervisorHub(params: { cityId?: number; branchId?: number } = {}) {
    const q = new URLSearchParams();
    if (params.cityId) q.set("cityId", String(params.cityId));
    if (params.branchId) q.set("branchId", String(params.branchId));

    const res = await fetch(`/api/quality/supervisor-hub?${q.toString()}`, { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load supervisor hub");
    }
    return res.json();
  },

  async listSlaPolicies(): Promise<{ data: SlaPolicy[] }> {
    const res = await fetch("/api/quality/sla-policies", { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to list SLA policies");
    }
    return res.json();
  },

  async createSlaPolicy(data: Partial<SlaPolicy>): Promise<SlaPolicy> {
    const res = await fetch("/api/quality/sla-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create SLA policy");
    }
    return res.json();
  },

  async cancelSubscriptionWithReason(
    subscriptionId: number,
    data: { customerId?: number; reason: string; feedback?: string }
  ) {
    const res = await fetch(`/api/customer/subscriptions/${subscriptionId}/cancel-with-reason`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to cancel subscription");
    }
    return res.json();
  },
};
