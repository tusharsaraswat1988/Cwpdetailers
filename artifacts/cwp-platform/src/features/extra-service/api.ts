import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SERVICE_EXECUTIONS_QUERY_KEY } from "@/features/service-executions/api";

export const EXTRA_SERVICE_QUERY_KEY = "extra-service";

export type ExtraServiceCommercialSource = "DCC_INCLUDED" | "PAID_EXTRA";

export type ExtraServiceRequestView = {
  id: number;
  requestType: string;
  status: "pending_customer_approval" | "customer_approved" | "otp_verified" | "rejected" | "cancelled";
  customerId: number;
  customerName: string;
  staffId: number;
  staffName: string;
  vehicleId: number;
  vehicleLabel: string;
  serviceId: number;
  serviceName: string;
  addonIds: number[];
  addonNames: string[];
  commercialSource: ExtraServiceCommercialSource;
  dcmsSubscriptionId: number | null;
  amount: number;
  amountDisplay: string;
  entitlementLabel: string | null;
  otpExpiresAt: string | null;
  otpExpired: boolean;
  customerApprovedAt: string | null;
  otpVerifiedAt: string | null;
  bookingId: number | null;
  executionId: number | null;
  createdAt: string;
  otp?: string;
};

export type ExtraServiceContext = {
  customer: { id: number; name: string };
  staff: { id: number; name: string };
  defaultVehicleId: number | null;
  dccSubscriptionId: number | null;
  vehicles: Array<{
    id: number;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    label: string;
  }>;
  services: Array<{
    id: number;
    name: string;
    price: number;
    durationMinutes: number | null;
    addons: Array<{ id: number; name: string; price: number }>;
  }>;
  dccByVehicle: Record<number, {
    subscriptionId: number;
    remainingWashes: number;
    planName: string;
  }>;
  openRequests: ExtraServiceRequestView[];
};

async function extraServiceFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export function useStaffExtraServiceContext(opts: {
  customerId?: number;
  subscriptionId?: number;
  vehicleId?: number;
  enabled?: boolean;
}) {
  const qs = new URLSearchParams();
  if (opts.customerId) qs.set("customerId", String(opts.customerId));
  if (opts.subscriptionId) qs.set("subscriptionId", String(opts.subscriptionId));
  if (opts.vehicleId) qs.set("vehicleId", String(opts.vehicleId));
  return useQuery({
    queryKey: [EXTRA_SERVICE_QUERY_KEY, "staff-context", opts],
    queryFn: () => extraServiceFetch<ExtraServiceContext>(`/staff/extra-service/context?${qs}`),
    enabled: opts.enabled !== false && (opts.customerId != null || opts.subscriptionId != null),
  });
}

export function useStaffExtraServiceRequests(customerId?: number, opts?: { enabled?: boolean; refetchInterval?: number }) {
  const qs = customerId ? `?customerId=${customerId}` : "";
  return useQuery({
    queryKey: [EXTRA_SERVICE_QUERY_KEY, "staff-requests", customerId],
    queryFn: () => extraServiceFetch<{ requests: ExtraServiceRequestView[] }>(`/staff/extra-service/requests${qs}`),
    enabled: opts?.enabled ?? true,
    refetchInterval: opts?.refetchInterval,
  });
}

export function useCreateExtraServiceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      customerId: number;
      vehicleId: number;
      serviceId: number;
      addonIds: number[];
      commercialSource: ExtraServiceCommercialSource;
      dcmsSubscriptionId?: number | null;
    }) => extraServiceFetch<{ request: ExtraServiceRequestView }>("/staff/extra-service/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [EXTRA_SERVICE_QUERY_KEY] }),
  });
}

export function useVerifyExtraServiceOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }: { id: number; code: string }) =>
      extraServiceFetch<{ request: ExtraServiceRequestView }>(`/staff/extra-service/requests/${id}/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXTRA_SERVICE_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ["staff-jobs"] });
      qc.invalidateQueries({ queryKey: SERVICE_EXECUTIONS_QUERY_KEY });
    },
  });
}

export function useCustomerExtraServicePending(enabled = true) {
  return useQuery({
    queryKey: [EXTRA_SERVICE_QUERY_KEY, "customer-pending"],
    queryFn: () => extraServiceFetch<{ requests: ExtraServiceRequestView[] }>("/customer/extra-service/pending"),
    enabled,
    refetchInterval: 3000,
  });
}

export function useApproveExtraService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      extraServiceFetch<{ request: ExtraServiceRequestView }>(`/customer/extra-service/requests/${id}/approve`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [EXTRA_SERVICE_QUERY_KEY, "customer-pending"] }),
  });
}

export function useRejectExtraService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      extraServiceFetch<{ request: ExtraServiceRequestView }>(`/customer/extra-service/requests/${id}/reject`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [EXTRA_SERVICE_QUERY_KEY, "customer-pending"] }),
  });
}
