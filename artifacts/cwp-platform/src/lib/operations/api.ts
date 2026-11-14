export type OperationsMetrics = {
  totalBookingsToday: number;
  confirmedBookingsToday: number;
  completedServicesToday: number;
  pendingServicesToday: number;
  cancelledBookingsToday: number;
  delayedServicesToday: number;
  unassignedJobsToday: number;
  openComplaintsCount: number;
  failedPaymentsCount: number;
  activeStaffOnField: number;
};

export type ImmediateAttentionItem = {
  id: string;
  type: "delayed_service" | "unassigned_job" | "critical_exception" | "sla_urgent" | "payment_failed";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  scheduledTime?: string;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  bookingId?: number | null;
  staffId?: number | null;
  staffName?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  actionType: "assign" | "reschedule" | "contact_customer" | "contact_staff" | "resolve_exception" | "view_ticket";
};

export type CityPerformanceItem = {
  cityId: number;
  cityName: string;
  totalBookings: number;
  completedCount: number;
  completionRate: number;
  unassignedCount: number;
  openExceptionsCount: number;
  activeStaffCount: number;
};

export type StaffInterventionItem = {
  staffId: number;
  staffName: string;
  staffPhone: string | null;
  cityId: number | null;
  cityName: string | null;
  branchId: number | null;
  delayedJobsCount: number;
  reportedExceptionsCount: number;
  primaryIssue: string;
};

export type LiveActivityItem = {
  id: string;
  timestamp: string;
  event: string;
  entityType: string;
  entityId: number;
  details: string;
};

export type CommandCenterData = {
  date: string;
  scope: {
    cityId: number | null;
    branchId: number | null;
  };
  metrics: OperationsMetrics;
  immediateAttention: ImmediateAttentionItem[];
  servicesBreakdown: {
    scheduled: number;
    assigned: number;
    enRoute: number;
    inProgress: number;
    completed: number;
    delayed: number;
    cancelled: number;
  };
  cityPerformance: CityPerformanceItem[];
  staffNeedingIntervention: StaffInterventionItem[];
  recentLiveActivity: LiveActivityItem[];
  lastRefreshedAt: string;
};

export type ServiceExceptionItem = {
  id: number;
  exceptionCode: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  reason: string;
  details?: Record<string, unknown> | null;
  bookingId?: number | null;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  staffId?: number | null;
  staffName?: string | null;
  executionId?: number | null;
  subscriptionId?: number | null;
  complaintId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  evidenceUrl?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: number | null;
  resolvedAt?: string | null;
  resolvedBy?: number | null;
  resolutionNotes?: string | null;
  resolutionAction?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const operationsApi = {
  async getCommandCenter(params: {
    date?: string;
    cityId?: number | null;
    branchId?: number | null;
    autoScan?: boolean;
  }): Promise<CommandCenterData> {
    const qs = new URLSearchParams();
    if (params.date) qs.set("date", params.date);
    if (params.cityId) qs.set("cityId", String(params.cityId));
    if (params.branchId) qs.set("branchId", String(params.branchId));
    if (params.autoScan !== undefined) qs.set("autoScan", String(params.autoScan));

    const res = await fetch(`/api/operations/command-center?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load operations command center");
    }
    return res.json();
  },

  async listExceptions(params: {
    category?: string;
    severity?: string;
    status?: string;
    cityId?: number | null;
    branchId?: number | null;
    customerId?: number | null;
    bookingId?: number | null;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ServiceExceptionItem[]; total: number; limit: number; offset: number; hasMore: boolean }> {
    const qs = new URLSearchParams();
    if (params.category && params.category !== "all") qs.set("category", params.category);
    if (params.severity && params.severity !== "all") qs.set("severity", params.severity);
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.cityId) qs.set("cityId", String(params.cityId));
    if (params.branchId) qs.set("branchId", String(params.branchId));
    if (params.customerId) qs.set("customerId", String(params.customerId));
    if (params.bookingId) qs.set("bookingId", String(params.bookingId));
    if (params.search) qs.set("search", params.search);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));

    const res = await fetch(`/api/operations/exceptions?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to list exceptions");
    }
    return res.json();
  },

  async scanExceptions(scope?: { cityId?: number; branchId?: number }) {
    const res = await fetch("/api/operations/exceptions/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope || {}),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to scan exceptions");
    }
    return res.json();
  },

  async acknowledgeException(id: number, notes?: string): Promise<ServiceExceptionItem> {
    const res = await fetch(`/api/operations/exceptions/${id}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to acknowledge exception");
    }
    return res.json();
  },

  async resolveException(
    id: number,
    payload: {
      action: string;
      resolutionNotes: string;
      assignedStaffId?: number;
      rescheduleDate?: string;
      rescheduleTime?: string;
    },
  ): Promise<ServiceExceptionItem> {
    const res = await fetch(`/api/operations/exceptions/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to resolve exception");
    }
    return res.json();
  },

  async createException(payload: {
    category: string;
    severity?: string;
    title: string;
    reason: string;
    bookingId?: number;
    customerId?: number;
    staffId?: number;
    cityId?: number;
    branchId?: number;
    details?: Record<string, unknown>;
  }): Promise<ServiceExceptionItem> {
    const res = await fetch("/api/operations/exceptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create exception");
    }
    return res.json();
  },

  async getCustomer360(customerId: number) {
    const res = await fetch(`/api/customers/${customerId}/360`, {
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load Customer 360 profile");
    }
    return res.json();
  },

  async getCustomerBookings(
    customerId: number,
    params: { limit?: number; offset?: number; status?: string } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    if (params.status && params.status !== "all") qs.set("status", params.status);

    const res = await fetch(`/api/customers/${customerId}/bookings?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load customer bookings");
    return res.json();
  },

  async getCustomerPayments(
    customerId: number,
    params: { limit?: number; offset?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));

    const res = await fetch(`/api/customers/${customerId}/payments?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load customer payments");
    return res.json();
  },
};
