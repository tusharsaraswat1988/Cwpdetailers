import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function dcmsFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type DcmsPlan = {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  includedCleanings: number;
  includedWashes: number;
  weeklyOffs: number;
  isActive: boolean;
  hasSubscriptions?: boolean;
};

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
  staffProductivity: Array<{ staffId: number; staffName: string; completed: number; rejected: number }>;
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

export function useDcmsPlans() {
  return useQuery({
    queryKey: ["dcms", "plans"],
    queryFn: () => dcmsFetch<DcmsPlan[]>("/daily-cleaning/plans"),
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

export function useDcmsAssignments(staffId?: number) {
  return useQuery({
    queryKey: ["dcms", "assignments", staffId],
    queryFn: () => dcmsFetch<unknown[]>(`/daily-cleaning/assignments${staffId ? `?staffId=${staffId}` : ""}`),
  });
}

export function useDcmsPlanMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["dcms"] });
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) =>
        dcmsFetch<DcmsPlan>("/daily-cleaning/plans", { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: Record<string, unknown> & { id: number }) =>
        dcmsFetch<DcmsPlan>(`/daily-cleaning/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
  };
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
    assign: useMutation({
      mutationFn: (data: { subscriptionId: number; staffId: number; routeOrder?: number }) =>
        dcmsFetch("/daily-cleaning/assignments", { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    renew: useMutation({
      mutationFn: (id: number) =>
        dcmsFetch(`/daily-cleaning/subscriptions/${id}/renew`, { method: "POST" }),
      onSuccess: invalidate,
    }),
  };
}

export function useStaffDcmsAssignments() {
  return useQuery({
    queryKey: ["dcms", "staff", "assignments"],
    queryFn: () => dcmsFetch<unknown[]>("/daily-cleaning/staff/assignments"),
  });
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
      dcmsFetch("/daily-cleaning/visits/complete", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dcms"] }),
  });
}

export function useCustomerDcmsDashboard() {
  return useQuery({
    queryKey: ["dcms", "customer", "dashboard"],
    queryFn: () => dcmsFetch<{ subscriptions: unknown[]; stats: Record<string, unknown> | null }>("/daily-cleaning/customer/dashboard"),
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

export function useStaffDailyRoute(date?: string) {
  const qs = date ? `?date=${date}` : "";
  return useQuery({
    queryKey: ["dcms", "staff", "daily-route", date],
    queryFn: () => dcmsFetch<{ date: string; stops: unknown[] }>(`/daily-cleaning/staff/daily-route${qs}`),
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
