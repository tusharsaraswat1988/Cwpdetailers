/**
 * Operations Control Center (Phase 2.3) — read-only aggregation layer.
 * Reuses existing Job Orchestration / Field Execution / Complaints endpoints.
 * No new backend routes, no mutations beyond what those modules already own.
 */
import {
  fetchJobs as fetchJobsBase,
  type Job as JobBase,
  type JobQueue,
} from "@/features/job-orchestration/api";

export {
  fetchJobDetail,
  fetchJobTimeline,
  JOBS_QUERY_KEY,
  type JobOpsStatus,
  type JobPriority,
  type JobQueue,
  type JobTimelineEntry,
} from "@/features/job-orchestration/api";

/** Backend's mapJob() also returns startedAt; the frontend Job type omits it. */
export type Job = JobBase & { startedAt: string | null };

export async function fetchJobs(filters: Parameters<typeof fetchJobsBase>[0] = {}): Promise<Job[]> {
  const jobs = await fetchJobsBase(filters);
  return jobs as Job[];
}

export {
  fetchExecutionDetail,
  SERVICE_EXECUTIONS_QUERY_KEY,
  type ExecutionDetail,
  type ExecutionPhoto,
  type ExecutionChecklistItem,
} from "@/features/service-executions/api";

/** Backend also returns locationLogs on execution detail; the shared frontend type omits it. */
export type ExecutionDetailWithLocation = import("@/features/service-executions/api").ExecutionDetail & {
  locationLogs?: { id: number; eventType: string; latitude: number | null; longitude: number | null; recordedAt: string }[];
  customerSignatureUrl?: string | null;
};

export type Complaint = {
  id: number;
  customerId: number;
  customerName: string | null;
  bookingId: number | null;
  relatedStaffId: number | null;
  relatedStaffName: string | null;
  assignedSupervisorId: number | null;
  assignedSupervisorName: string | null;
  type: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export async function fetchOpenComplaints(limit = 50): Promise<{ data: Complaint[]; total: number }> {
  const res = await fetch(`/api/complaints?status=open&limit=${limit}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load complaints");
  return res.json();
}

export const OPS_CONSOLE_QUERY_KEY = ["ops-console"];
