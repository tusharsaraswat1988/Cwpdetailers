export const JOBS_QUERY_KEY = ["jobs"];

export type JobOpsStatus =
  | "in_field"
  | "pending_quality_review"
  | "reopened"
  | "approved"
  | "ready_for_billing"
  | "cancelled";

export type JobPriority = "low" | "normal" | "high" | "urgent";

export type JobQueue =
  | "active"
  | "completed"
  | "escalated"
  | "reopened"
  | "quality_review"
  | "ready_for_billing"
  | "all";

export type Job = {
  id: number;
  jobId: number;
  executionId: number;
  customerId: number;
  customerName: string;
  locationLabel: string | null;
  assetLabel: string | null;
  assignedStaffId: number;
  staffName: string;
  taskType: string;
  scheduledDate: string;
  scheduledTime: string | null;
  fieldStatus: string;
  opsStatus: JobOpsStatus;
  priority: JobPriority;
  dependsOnExecutionId: number | null;
  isEscalated: boolean;
  escalationReason: string | null;
  escalatedAt: string | null;
  opsOwnerUserId: number | null;
  qualityReviewStartedAt: string | null;
  approvedAt: string | null;
  readyForBillingAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobTimelineEntry = {
  id: string;
  source: "field" | "ops";
  eventType: string;
  title: string;
  description: string | null;
  actorId: number | null;
  actorName: string | null;
  createdAt: string;
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

export async function fetchJobs(filters: {
  queue?: JobQueue;
  priority?: JobPriority;
  opsStatus?: JobOpsStatus;
  limit?: number;
} = {}): Promise<Job[]> {
  const params = new URLSearchParams();
  if (filters.queue) params.set("queue", filters.queue);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.opsStatus) params.set("opsStatus", filters.opsStatus);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await apiFetch<{ data: Job[] }>(`/jobs${qs ? `?${qs}` : ""}`);
  return res.data;
}

export async function fetchJobDetail(id: number): Promise<Job> {
  return apiFetch(`/jobs/${id}`);
}

export async function fetchJobTimeline(id: number): Promise<JobTimelineEntry[]> {
  return apiFetch(`/jobs/${id}/timeline`);
}

export async function reopenJob(id: number, reason?: string): Promise<Job> {
  return apiFetch(`/jobs/${id}/reopen`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function escalateJob(id: number, reason: string): Promise<Job> {
  return apiFetch(`/jobs/${id}/escalate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function changeJobPriority(id: number, priority: JobPriority): Promise<Job> {
  return apiFetch(`/jobs/${id}/priority`, {
    method: "POST",
    body: JSON.stringify({ priority }),
  });
}

export async function approveJob(id: number, notes?: string): Promise<Job> {
  return apiFetch(`/jobs/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function markJobReadyForBilling(id: number): Promise<Job> {
  return apiFetch(`/jobs/${id}/ready-for-billing`, { method: "POST", body: "{}" });
}

export async function cancelJob(id: number, reason?: string): Promise<Job> {
  return apiFetch(`/jobs/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function opsStatusLabel(status: JobOpsStatus): string {
  switch (status) {
    case "in_field": return "In field";
    case "pending_quality_review": return "Quality review";
    case "reopened": return "Reopened";
    case "approved": return "Approved";
    case "ready_for_billing": return "Ready for billing";
    case "cancelled": return "Cancelled";
    default: return status;
  }
}

export function priorityLabel(priority: JobPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * UX-only derived tone/label for opsStatus — StatusBadge's shared map doesn't
 * cover the job-orchestration vocabulary (in_field / pending_quality_review /
 * ready_for_billing), so callers pass these explicitly instead of adding a
 * one-off status map in feature code.
 */
export function opsStatusTone(status: JobOpsStatus): "info" | "warning" | "success" | "destructive" | "neutral" | "progress" {
  switch (status) {
    case "in_field": return "progress";
    case "pending_quality_review": return "warning";
    case "reopened": return "warning";
    case "approved": return "info";
    case "ready_for_billing": return "success";
    case "cancelled": return "destructive";
    default: return "neutral";
  }
}
