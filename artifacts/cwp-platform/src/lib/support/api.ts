export type SupportTicketMessage = {
  id: number;
  complaintId: number;
  senderType: "customer" | "staff" | "admin" | "system";
  senderId?: number | null;
  senderName: string;
  message: string;
  isInternal: boolean;
  attachmentUrl?: string | null;
  createdAt: string;
};

export type SupportTicket = {
  id: number;
  ticketNumber: string;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  cityId?: number | null;
  cityName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  bookingId?: number | null;
  subscriptionId?: number | null;
  visitId?: number | null;
  invoiceId?: number | null;
  operationalExceptionId?: number | null;
  type: string;
  priority: string;
  status: string;
  title: string;
  description?: string | null;
  photoUrl?: string | null;
  resolution?: string | null;
  internalNotes?: string | null;
  assignedSupervisorId?: number | null;
  assignedSupervisorName?: string | null;
  relatedStaffId?: number | null;
  relatedStaffName?: string | null;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  messages?: SupportTicketMessage[];
};

export const supportApi = {
  async listTickets(params: {
    customerId?: number;
    cityId?: number;
    branchId?: number;
    status?: string;
    type?: string;
    priority?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: SupportTicket[]; total: number }> {
    const q = new URLSearchParams();
    if (params.customerId) q.set("customerId", String(params.customerId));
    if (params.cityId) q.set("cityId", String(params.cityId));
    if (params.branchId) q.set("branchId", String(params.branchId));
    if (params.status && params.status !== "all") q.set("status", params.status);
    if (params.type && params.type !== "all") q.set("type", params.type);
    if (params.priority && params.priority !== "all") q.set("priority", params.priority);
    if (params.search) q.set("search", params.search);
    if (params.limit) q.set("limit", String(params.limit));
    if (params.offset) q.set("offset", String(params.offset));

    const res = await fetch(`/api/support/tickets?${q.toString()}`, { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load support tickets");
    }
    return res.json();
  },

  async getTicket(id: number): Promise<SupportTicket> {
    const res = await fetch(`/api/support/tickets/${id}`, { credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load ticket details");
    }
    return res.json();
  },

  async createTicket(data: {
    customerId?: number;
    type: string;
    priority?: string;
    title: string;
    description: string;
    bookingId?: number;
    cityId?: number;
    branchId?: number;
    subscriptionId?: number;
    visitId?: number;
    operationalExceptionId?: number;
    photoUrl?: string;
  }): Promise<SupportTicket> {
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create support ticket");
    }
    return res.json();
  },

  async addMessage(
    ticketId: number,
    data: { message: string; isInternal?: boolean; attachmentUrl?: string }
  ): Promise<SupportTicketMessage> {
    const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to send message");
    }
    return res.json();
  },

  async updateStatus(ticketId: number, status: string): Promise<SupportTicket> {
    const res = await fetch(`/api/support/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to update ticket status");
    }
    return res.json();
  },

  async resolveTicket(
    ticketId: number,
    data: {
      resolutionAction: "grant_makeup_credit" | "schedule_reclean" | "reassign_staff" | "custom_resolution" | "no_action_needed";
      resolution: string;
      internalNotes?: string;
    }
  ): Promise<SupportTicket> {
    const res = await fetch(`/api/support/tickets/${ticketId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to resolve ticket");
    }
    return res.json();
  },
};
