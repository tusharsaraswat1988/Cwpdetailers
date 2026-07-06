export const SERVICE_EXECUTIONS_QUERY_KEY = ["service-executions"];

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
  status: "scheduled" | "started" | "completed" | "missed" | "cancelled" | "rescheduled";
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

export type ExecutionDetail = ServiceExecution & {
  photos: ExecutionPhoto[];
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

export async function completeExecution(
  id: number,
  gps?: { latitude: number; longitude: number; accuracy?: number },
): Promise<ServiceExecution> {
  return apiFetch(`/service-executions/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy } : {}),
  });
}
