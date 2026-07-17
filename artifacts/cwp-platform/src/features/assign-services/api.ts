export const ASSIGNMENTS_QUERY_KEY = ["service-assignments"];

export type AssignmentPriority = "normal" | "high";

export type ServiceTaskType =
  | "daily_cleaning"
  | "car_wash"
  | "solar_cleaning"
  | "interior_detailing"
  | "one_time_service";

export type TaskAssignmentSlot = {
  taskType: ServiceTaskType;
  taskTypeLabel: string;
  assignmentId?: number;
  staffId?: number;
  staffName?: string;
};

export type PendingAssignment = {
  id: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  serviceLocationType: string | null;
  serviceLocationCity: string | null;
  assetId: number | null;
  assetLabel: string | null;
  serviceId: number | null;
  serviceName: string;
  serviceType: string;
  priority: AssignmentPriority;
  createdAt: string;
  requiredTasks: TaskAssignmentSlot[];
  bookingId: number | null;
  bookingStatus: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  sourceSystem: string;
  sourceId: number;
  notes: string | null;
  branchId: number | null;
};

export type AssignedService = {
  id: number;
  pendingAssignmentId: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  serviceLocationType: string | null;
  serviceLocationCity: string | null;
  assetId: number | null;
  assetLabel: string | null;
  assignedStaffId: number;
  staffName: string;
  serviceName: string;
  serviceType: string;
  taskType: ServiceTaskType;
  taskTypeLabel: string;
  assignedAt: string;
  status: "assigned" | "ready_for_execution";
  bookingId: number | null;
  notes: string | null;
};

export type AssignmentTimelineEntry = {
  id: number;
  eventType: string;
  title: string;
  description: string | null;
  fromStaffId: number | null;
  toStaffId: number | null;
  actorId: number | null;
  actorName: string | null;
  notes: string | null;
  createdAt: string;
};

export type AssignmentDetail = AssignedService & {
  serviceLocationAddress: string | null;
  queuedAt: string | null;
  status: "pending" | "assigned" | "ready_for_execution" | "removed";
  timeline?: AssignmentTimelineEntry[];
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

export async function fetchAssignmentTimeline(id: number): Promise<AssignmentTimelineEntry[]> {
  const res = await fetch(`/api/assignments/${id}/timeline`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load timeline");
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

export type TaskAssignmentInput = {
  taskType: ServiceTaskType;
  staffId: number;
};

export async function assignPendingServiceTasks(
  pendingId: number,
  tasks: TaskAssignmentInput[],
  notes?: string,
): Promise<AssignedService[]> {
  const res = await fetch(`/api/assignments/${pendingId}/assign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Assignment failed");
  }
  return res.json();
}

export async function reassignAssignment(
  assignmentId: number,
  staffId: number,
  notes?: string,
): Promise<AssignedService> {
  const res = await fetch(`/api/assignments/${assignmentId}/reassign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffId, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Reassignment failed");
  }
  return res.json();
}

export async function removeAssignment(assignmentId: number, notes?: string): Promise<{ id: number; status: string }> {
  const res = await fetch(`/api/assignments/${assignmentId}/remove`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Remove failed");
  }
  return res.json();
}

export async function recordSubstituteExecution(input: {
  contractId: number;
  taskType: ServiceTaskType;
  substituteStaffId: number;
  scheduledDate?: string;
  reason?: string;
}): Promise<{ executionId: number }> {
  const res = await fetch("/api/assignments/substitute", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Substitute failed");
  }
  return res.json();
}

export type StaffOption = {
  id: number;
  name: string;
  employeeCode?: string | null;
  operationalRoles?: Array<{ roleName: string; roleSlug: string }>;
};

export async function fetchStaffForAssignment(roleSlug?: string): Promise<StaffOption[]> {
  const params = new URLSearchParams({ forAssignment: "true", isActive: "true", staffCategory: "cleaning_staff" });
  if (roleSlug) params.set("roleSlug", roleSlug);
  const res = await fetch(`/api/staff?${params.toString()}`, { credentials: "include" });
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
