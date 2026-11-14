import type { ScheduledJob, JobExecutionHistory, WorkerHeartbeat } from "@workspace/db";

export type ScheduleType = "one_time" | "recurring_interval" | "recurring_cron";
export type JobStatus = "active" | "paused" | "completed" | "failed" | "cancelled";
export type ExecutionStatus = "running" | "success" | "failed" | "cancelled" | "retrying";
export type TriggerType = "scheduled" | "manual" | "retry";

export interface JobContext {
  jobId: number;
  jobKey: string;
  jobType: string;
  payload: Record<string, any>;
  cityId?: number | null;
  branchId?: number | null;
  triggerType: TriggerType;
  attempt: number;
  workerId: string;
  dryRun?: boolean;
  logger: any;
}

export interface JobResult {
  success: boolean;
  processedCount?: number;
  metrics?: Record<string, any>;
  message?: string;
  error?: string;
}

export type JobHandler = (context: JobContext) => Promise<JobResult>;

export interface SchedulerKPIs {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  runningJobs: number;
  successJobs24h: number;
  failedJobs24h: number;
  pendingJobs: number;
  retryQueueCount: number;
  overdueJobs: number;
  avgExecutionDurationMs: number;
  activeWorkersCount: number;
  lastWorkerHeartbeat: string | null;
}

export interface WorkerOptions {
  workerId?: string;
  concurrency?: number;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number;
}
