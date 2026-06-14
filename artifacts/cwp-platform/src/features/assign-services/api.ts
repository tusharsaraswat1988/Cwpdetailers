export const ASSIGNMENTS_QUERY_KEY = ["service-assignments"];

export type AssignmentPriority = "normal" | "high";

export type PendingAssignment = {
  id: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  assetId: number | null;
  assetLabel: string | null;
  serviceId: number | null;
  serviceName: string;
  serviceType: string;
  priority: AssignmentPriority;
  createdAt: string;
};

export type AssignedService = {
  id: number;
  pendingAssignmentId: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  assetId: number | null;
  assetLabel: string | null;
  assignedStaffId: number;
  staffName: string;
  serviceName: string;
  serviceType: string;
  assignedAt: string;
  status: "assigned";
};

export type AssignmentDetail = AssignedService & {
  serviceLocationAddress: string | null;
  queuedAt: string | null;
  status: "pending" | "assigned";
};

export type AssignmentFilters = {
  serviceType?: string;
  serviceLocationId?: number;
  staffId?: number;
  dateFrom?: string;
  dateTo?: string;
};

function buildQuery(filters?: AssignmentFilters): string {
  const params = new URLSearchParams();
  if (filters?.serviceType) params.set("serviceType", filters.serviceType);
  if (filters?.serviceLocationId) params.set("serviceLocationId", String(filters.serviceLocationId));
  if (filters?.staffId) params.set("staffId", String(filters.staffId));
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchPendingAssignments(filters?: AssignmentFilters): Promise<PendingAssignment[]> {
  const res = await fetch(`/api/assignments/pending${buildQuery(filters)}`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load pending assignments");
  }
  return res.json();
}

export async function fetchAssignedServices(filters?: AssignmentFilters): Promise<AssignedService[]> {
  const res = await fetch(`/api/assignments/assigned${buildQuery(filters)}`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load assigned services");
  }
  return res.json();
}

export async function fetchAssignmentDetail(id: number): Promise<AssignmentDetail> {
  const res = await fetch(`/api/assignments/${id}`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load assignment");
  }
  return res.json();
}

export async function assignPendingService(pendingId: number, staffId: number): Promise<AssignedService> {
  const res = await fetch(`/api/assignments/${pendingId}/assign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Assignment failed");
  }
  return res.json();
}

export type StaffOption = { id: number; name: string; employeeCode?: string | null };

export async function fetchStaffForAssignment(): Promise<StaffOption[]> {
  const res = await fetch("/api/staff?forAssignment=true&isActive=true", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load staff");
  return res.json();
}

export const SERVICE_TYPE_OPTIONS = [
  { value: "", label: "All service types" },
  { value: "one_time_service", label: "One-Time Service" },
  { value: "daily_cleaning", label: "Daily Cleaning" },
  { value: "wash_package", label: "Wash Package" },
  { value: "monthly_wash", label: "Monthly Wash" },
  { value: "solar_amc", label: "Solar AMC" },
  { value: "detailing_plan", label: "Detailing Plan" },
];

export function formatServiceType(value: string): string {
  const match = SERVICE_TYPE_OPTIONS.find(o => o.value === value);
  if (match) return match.label;
  return value.replace(/_/g, " ");
}
