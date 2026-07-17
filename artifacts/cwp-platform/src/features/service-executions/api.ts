export const SERVICE_EXECUTIONS_QUERY_KEY = ["service-executions"];

export type ServiceExecutionStatus =
  | "scheduled"
  | "ready_for_execution"
  | "started"
  | "paused"
  | "resumed"
  | "completed"
  | "missed"
  | "cancelled"
  | "rescheduled";

export type ServiceExecution = {
  id: number;
  serviceAssignmentId: number | null;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  serviceLocationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  assetId: number | null;
  assetLabel: string | null;
  serviceLabel: string | null;
  assignedStaffId: number;
  staffName: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: ServiceExecutionStatus;
  taskType?: string;
  taskTypeLabel?: string;
  isSubstitute?: boolean;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  completedAt?: string | null;
  customerSignatureUrl?: string | null;
};

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function fetchTodayExecutions(): Promise<ServiceExecution[]> {
  return apiFetch("/service-executions/today");
}

export async function fetchStaffExecutions(limit = 100): Promise<ServiceExecution[]> {
  const res = await apiFetch<{ data: ServiceExecution[] }>(`/service-executions?limit=${limit}`);
  return res.data;
}

export type ExecutionPhoto = {
  id: number;
  kind: string;
  url: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
};

export type ExecutionChecklistItem = {
  id: number;
  label: string;
  isCompleted: boolean;
  completedAt?: string | null;
};

export type ExecutionDetail = ServiceExecution & {
  photos: ExecutionPhoto[];
  notes?: { id: number; kind: string; body: string; createdAt: string }[];
  checklist?: ExecutionChecklistItem[];
  timeline?: {
    id: number;
    eventType: string;
    title: string;
    description: string | null;
    createdAt: string;
  }[];
};

export async function fetchExecutionDetail(id: number): Promise<ExecutionDetail> {
  return apiFetch(`/service-executions/${id}`);
}

export async function addExecutionPhotos(
  id: number,
  photos: { kind: "before" | "after"; url: string; latitude: number; longitude: number; accuracy?: number }[],
): Promise<ExecutionDetail> {
  return apiFetch(`/service-executions/${id}/photos`, {
    method: "POST",
    body: JSON.stringify({ photos }),
  });
}

export async function startExecution(
  id: number,
  gps?: { latitude: number; longitude: number; accuracy?: number },
): Promise<ServiceExecution> {
  return apiFetch(`/service-executions/${id}/start`, {
    method: "POST",
    body: JSON.stringify(gps ?? {}),
  });
}

export async function pauseExecution(id: number, reason?: string): Promise<ServiceExecution> {
  return apiFetch(`/service-executions/${id}/pause`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function resumeExecution(id: number): Promise<ServiceExecution> {
  return apiFetch(`/service-executions/${id}/resume`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function saveExecutionNotes(id: number, body: string): Promise<ExecutionDetail> {
  return apiFetch(`/service-executions/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ body, kind: "technician" }),
  });
}

export async function saveExecutionChecklist(
  id: number,
  items: { id?: number; label: string; isCompleted: boolean }[],
): Promise<ExecutionDetail> {
  return apiFetch(`/service-executions/${id}/checklist`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function completeExecution(
  id: number,
  opts?: {
    gps?: { latitude: number; longitude: number; accuracy?: number };
    notes?: string;
    customerSignatureUrl?: string;
  },
): Promise<ServiceExecution> {
  const gps = opts?.gps;
  return apiFetch(`/service-executions/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({
      ...(gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy } : {}),
      ...(opts?.notes?.trim()
        ? { notes: [{ kind: "technician", body: opts.notes.trim() }] }
        : {}),
      ...(opts?.customerSignatureUrl
        ? { customerSignatureUrl: opts.customerSignatureUrl }
        : {}),
    }),
  });
}
