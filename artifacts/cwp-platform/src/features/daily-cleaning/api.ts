import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queuedFetch } from "@/services/queuedApi";

async function dcmsFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const bodyText = await res.text();
    let message = res.statusText || "Request failed";
    try {
      const parsed = JSON.parse(bodyText) as { error?: string; code?: string };
      if (parsed.error?.trim()) message = parsed.error;
      else if (parsed.code === "PAYLOAD_TOO_LARGE") message = "Photo upload too large — try lower camera resolution";
    } catch {
      if (bodyText.trim()) message = bodyText.slice(0, 200);
    }
    const err = new Error(message) as Error & { status?: number; body?: string };
    err.status = res.status;
    err.body = bodyText;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function dcmsStaffMutate<T>(
  path: string,
  data: Record<string, unknown>,
  label: string,
): Promise<T | { queued: true }> {
  const result = await queuedFetch(
    `/api${path}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    { operationType: "staff_visit", label },
  );
  if (result.queued) return { queued: true };
  if (!result.ok) throw result.error;
  if (!result.response.ok) {
    const bodyText = await result.response.text();
    let message = result.response.statusText || "Request failed";
    try {
      const parsed = JSON.parse(bodyText) as { error?: string; code?: string };
      if (parsed.error?.trim()) message = parsed.error;
      else if (parsed.code === "PAYLOAD_TOO_LARGE") message = "Photo upload too large — try lower camera resolution";
    } catch {
      if (bodyText.trim()) message = bodyText.slice(0, 200);
    }
    throw new Error(message);
  }
  if (result.response.status === 204) return undefined as T;
  return result.response.json() as Promise<T>;
}

export type DcmsPlanAddon = {
  id: number;
  planId: number;
  addonId: number;
  addonName: string;
  addonBasePrice: string;
  includedCleanings: number;
  includedWashes: number;
  extraPrice?: string | null;
  sortOrder: number;
};

export type DcmsPlan = {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  includedCleanings: number;
  includedWashes: number;
  weeklyOffs: number;
  vehicleCategoryId?: number | null;
  seatCategoryId?: number | null;
  vehicleCategoryName?: string | null;
  seatCategoryName?: string | null;
  seatCount?: number | null;
  seatPricingTier?: "standard" | "large" | null;
  seatPricingTierLabel?: string | null;
  scopeVehicleLabel?: string | null;
  scopeSeatLabel?: string | null;
  addons?: DcmsPlanAddon[];
  showOnHomepage?: boolean;
  isActive: boolean;
  hasSubscriptions?: boolean;
  applicable?: boolean;
  inapplicableReason?: string | null;
};

export type CreatePlansResult = DcmsPlan | { plans: DcmsPlan[]; count: number };

export type DcmsSubscriptionRow = {
  subscription: {
    id: number;
    customerId: number;
    vehicleId: number;
    planId: number;
    startDate: string;
    allocatedCleanings: number;
    allocatedWashes: number;
    usedCleanings: number;
    usedWashes: number;
    remainingCleanings: number;
    remainingWashes: number;
    status: string;
  };
  planName: string;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
};

export type DcmsVisitRow = {
  visit: {
    id: number;
    subscriptionId: number;
    vehicleId: number;
    staffId: number;
    visitType: string;
    photoUrl?: string | null;
    visitTime: string;
    status: string;
    latitude?: number | null;
    longitude?: number | null;
    rejectionReason?: string | null;
    ocrText?: string | null;
    ocrConfidence?: number | null;
    confirmedRegistration?: string | null;
  };
  staffName: string;
  vehicleNumber: string;
  customerName: string;
};

export type ServiceHistoryVisitCell = {
  visitId: number;
  time: string;
  staffName: string;
  photoUrl?: string | null;
  status: string;
  rejectionReason?: string | null;
};

export type ServiceHistoryRow = {
  vehicleId: number;
  vehicleNumber: string;
  customerId: number;
  customerName: string;
  subscriptionId: number;
  planName: string;
  cleaning?: ServiceHistoryVisitCell;
  wash?: ServiceHistoryVisitCell;
};

export type ServiceHistoryDay = {
  date: string;
  rows: ServiceHistoryRow[];
};

export type DashboardStats = {
  activeSubscriptions: number;
  pendingVisits: number;
  completedVisits: number;
  renewalsDue: number;
  missedVisits: number;
  outstandingCount?: number;
  outstandingSubscriptions?: Array<{
    customerName: string;
    vehicleNumber: string;
    planName: string;
    pendingCleanings: number;
    missedCleanings: number;
  }>;
  completionPercentage: number;
  washConsumption: { used: number; allocated: number };
  staffProductivity: Array<{ staffId: number; staffName: string; completed: number; carNotAvailable?: number; rejected: number }>;
  todayOps?: {
    date: string;
    scheduled: number;
    completed: number;
    carNotAvailable: number;
    otherException: number;
    stillPending: number;
  };
  carNotAvailableVisits?: number;
  feedback?: {
    negativeFeedbackCount: number;
    pendingFeedback: number;
    feedbackRate: number;
  };
  renewalOps?: {
    renewalEligible: number;
    renewalDueSoon: number;
    outstandingVisits: number;
    outstandingWashes: number;
    pausedSubscriptions: number;
    inactiveSubscriptions: number;
    pendingPauseRequests: number;
  };
  staffPerformance?: {
    topPerformers: StaffPerformanceRow[];
    lowestPerformers: StaffPerformanceRow[];
  };
  fraud: {
    rejectedUploads: number;
    outsideRadiusAttempts: number;
    repeatedGpsMismatch: Array<{ staffId: number; staffName: string; count: number }>;
    suspiciousActivity: number;
  };
};

export type StaffPerformanceRow = {
  staffId: number;
  staffName: string;
  assignedVehicles: number;
  completedVisits: number;
  carNotAvailableVisits?: number;
  missedVisits: number;
  rejectedVisits: number;
  completionPercentage: number;
  customerComplaints: number;
  customerRating: number;
};

export function useDcmsDashboard() {
  return useQuery({
    queryKey: ["dcms", "dashboard"],
    queryFn: () => dcmsFetch<DashboardStats>("/daily-cleaning/admin/dashboard"),
  });
}

export function useDcmsPlans(vehicleId?: number) {
  const params = new URLSearchParams();
  params.set("active", "true");
  if (vehicleId) {
    params.set("vehicleId", String(vehicleId));
  }
  const qs = params.toString() ? `?${params}` : "";
  return useQuery({
    queryKey: ["dcms", "plans", vehicleId],
    queryFn: () => dcmsFetch<DcmsPlan[]>(`/daily-cleaning/plans${qs}`),
  });
}

export function useDcmsSubscriptions(status?: string) {
  return useQuery({
    queryKey: ["dcms", "subscriptions", status],
    queryFn: () => dcmsFetch<DcmsSubscriptionRow[]>(`/daily-cleaning/subscriptions${status ? `?status=${status}` : ""}`),
  });
}

export function useDcmsVisits(filters?: Record<string, string | number>) {
  const qs = filters ? "?" + new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)])).toString() : "";
  return useQuery({
    queryKey: ["dcms", "visits", filters],
    queryFn: () => dcmsFetch<DcmsVisitRow[]>(`/daily-cleaning/visits${qs}`),
  });
}

export function useDcmsServiceHistory(filters?: Record<string, string | number>) {
  const qs = filters ? "?" + new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)])).toString() : "";
  return useQuery({
    queryKey: ["dcms", "service-history", filters],
    queryFn: () => dcmsFetch<ServiceHistoryDay[]>(`/daily-cleaning/service-history${qs}`),
    enabled: !!filters,
  });
}

export function useDcmsSubscriptionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["dcms"] });
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) =>
        dcmsFetch("/daily-cleaning/subscriptions", { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    renew: useMutation({
      mutationFn: (id: number) =>
        dcmsFetch(`/daily-cleaning/subscriptions/${id}/renew`, { method: "POST" }),
      onSuccess: invalidate,
    }),
  };
}

export function useDcmsPlanMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["dcms"] });
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) =>
        dcmsFetch<CreatePlansResult>("/daily-cleaning/plans", { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: Record<string, unknown> & { id: number }) =>
        dcmsFetch<DcmsPlan>(`/daily-cleaning/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: number) =>
        dcmsFetch(`/daily-cleaning/plans/${id}`, { method: "DELETE" }),
      onSuccess: invalidate,
    }),
  };
}

export function useVehicleSearch(registration: string, enabled: boolean) {
  return useQuery({
    queryKey: ["dcms", "vehicle-search", registration],
    queryFn: () => dcmsFetch<unknown>(`/daily-cleaning/vehicles/search?registration=${encodeURIComponent(registration)}`),
    enabled: enabled && registration.length >= 4,
  });
}

export function useRecognizePlate() {
  return useMutation({
    mutationFn: (data: { rawText: string; confidence: number }) =>
      dcmsFetch<{
        ocr: { rawText: string; extractedRegistration: string | null; normalizedRegistration: string | null; confidence: number };
        autoSelect: boolean;
        vehicle: unknown | null;
      }>("/daily-cleaning/plates/recognize", { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useCompleteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      dcmsStaffMutate("/daily-cleaning/visits/complete", data, "Daily clean visit"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dcms"] }),
  });
}

export function useRecordCarNotAvailable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      dcmsStaffMutate("/daily-cleaning/visits/car-not-available", data, "Car not available"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dcms"] }),
  });
}

export function useCustomerDcmsDashboard(enabled = true) {
  return useQuery({
    queryKey: ["dcms", "customer", "dashboard"],
    queryFn: () => dcmsFetch<{ subscriptions: unknown[]; stats: Record<string, unknown> | null }>("/daily-cleaning/customer/dashboard"),
    enabled,
    retry: false,
  });
}

export function useCustomerDcmsVisits(filters?: Record<string, string | number>) {
  const qs = filters ? "?" + new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)])).toString() : "";
  return useQuery({
    queryKey: ["dcms", "customer", "visits", filters],
    queryFn: () => dcmsFetch<DcmsVisitRow[]>(`/daily-cleaning/customer/visits${qs}`),
  });
}

export function useCustomerDcmsGallery(filters?: Record<string, string | number>) {
  const qs = filters ? "?" + new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)])).toString() : "";
  return useQuery({
    queryKey: ["dcms", "customer", "gallery", filters],
    queryFn: () => dcmsFetch<DcmsVisitRow[]>(`/daily-cleaning/customer/gallery${qs}`),
  });
}

export function useStaffDailyRoute(date?: string, opts?: { enabled?: boolean }) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return useQuery({
    queryKey: ["dcms", "staff", "daily-route", date ?? "today"],
    queryFn: () => dcmsFetch<{ date: string; stops: unknown[] }>(`/daily-cleaning/staff/daily-route${qs}`),
    enabled: opts?.enabled ?? true,
  });
}

export function useDcmsWashes(filters?: Record<string, string | number>) {
  const qs = filters ? "?" + new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)])).toString() : "";
  return useQuery({
    queryKey: ["dcms", "washes", filters],
    queryFn: () => dcmsFetch<DcmsVisitRow[]>(`/daily-cleaning/washes${qs}`),
  });
}

export function useCustomerDcmsWashes() {
  return useQuery({
    queryKey: ["dcms", "customer", "washes"],
    queryFn: () => dcmsFetch<DcmsVisitRow[]>("/daily-cleaning/customer/washes"),
  });
}

export function useStaffPerformance() {
  return useQuery({
    queryKey: ["dcms", "staff-performance"],
    queryFn: () => dcmsFetch<{ staff: StaffPerformanceRow[]; topPerformers: StaffPerformanceRow[]; lowestPerformers: StaffPerformanceRow[] }>(
      "/daily-cleaning/admin/staff-performance",
    ),
  });
}

export function usePendingFeedback() {
  return useQuery({
    queryKey: ["dcms", "customer", "pending-feedback"],
    queryFn: () => dcmsFetch<Array<{ visit: { id: number; visitTime: string }; vehicleId: number }>>(
      "/daily-cleaning/customer/pending-feedback",
    ),
  });
}

export function useSubmitVisitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { visitId: number; rating: "yes" | "no"; comment?: string }) =>
      dcmsFetch("/daily-cleaning/customer/feedback", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dcms"] });
    },
  });
}

export function usePauseMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["dcms"] });
  return {
    pause: useMutation({
      mutationFn: ({ id, ...data }: { id: number; pauseStartDate: string; pauseEndDate: string; pauseReason?: string }) =>
        dcmsFetch(`/daily-cleaning/subscriptions/${id}/pause`, { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    resume: useMutation({
      mutationFn: (id: number) =>
        dcmsFetch(`/daily-cleaning/subscriptions/${id}/resume`, { method: "POST" }),
      onSuccess: invalidate,
    }),
    requestPause: useMutation({
      mutationFn: (data: { subscriptionId: number; pauseStartDate: string; pauseEndDate: string; pauseReason?: string }) =>
        dcmsFetch("/daily-cleaning/customer/pause-request", { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    approvePause: useMutation({
      mutationFn: (historyId: number) =>
        dcmsFetch(`/daily-cleaning/pause-requests/${historyId}/approve`, { method: "POST" }),
      onSuccess: invalidate,
    }),
  };
}

export { dcmsFetch };
