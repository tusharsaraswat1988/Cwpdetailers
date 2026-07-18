/**
 * Phase 5.5 — Job Orchestration validation.
 * Does NOT validate billing, inventory, routes, or technician field performance.
 */

import type { Request } from "express";
import type { JobOpsStatus, JobPriority, ServiceExecution } from "@workspace/db";

export const JOB_OPS_STATUSES: JobOpsStatus[] = [
  "in_field",
  "pending_quality_review",
  "reopened",
  "approved",
  "ready_for_billing",
  "cancelled",
];

export const JOB_PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];

export const ACTIVE_OPS_STATUSES: JobOpsStatus[] = [
  "in_field",
  "pending_quality_review",
  "reopened",
];

export const REVIEWABLE_OPS_STATUSES: JobOpsStatus[] = [
  "pending_quality_review",
];

export function isJobOpsCancelled(opsStatus: string): boolean {
  return opsStatus === "cancelled";
}

export function isJobReadyForBilling(opsStatus: string): boolean {
  return opsStatus === "ready_for_billing";
}

export function assertCanReopen(job: ServiceExecution): void {
  if (job.opsStatus === "cancelled" || job.status === "cancelled") {
    throw new Error("Cancelled job cannot be reopened");
  }
  if (job.opsStatus === "ready_for_billing") {
    throw new Error("Job already ready for billing — cannot reopen");
  }
  if (job.status !== "completed") {
    throw new Error("Job must be field-completed before reopen");
  }
  if (job.opsStatus !== "pending_quality_review" && job.opsStatus !== "approved") {
    throw new Error("Only jobs in quality review or approved can be reopened");
  }
}

export function assertCanApprove(job: ServiceExecution): void {
  if (job.opsStatus === "cancelled") {
    throw new Error("Cancelled job cannot be approved");
  }
  if (job.opsStatus === "approved" || job.opsStatus === "ready_for_billing") {
    throw new Error(`Job is already ${job.opsStatus}`);
  }
  if (job.opsStatus !== "pending_quality_review") {
    throw new Error("Job must be in quality review to approve");
  }
  if (job.status !== "completed") {
    throw new Error("Field execution must be completed before approval");
  }
}

export function assertCanMarkReadyForBilling(job: ServiceExecution): void {
  if (job.opsStatus === "cancelled") {
    throw new Error("Cancelled job cannot be marked ready for billing");
  }
  if (job.opsStatus === "ready_for_billing") {
    throw new Error("Job is already ready for billing");
  }
  if (job.opsStatus !== "approved") {
    throw new Error("Job must be approved before ready for billing");
  }
}

export function assertCanCancel(job: ServiceExecution): void {
  if (job.opsStatus === "cancelled" || job.status === "cancelled") {
    throw new Error("Job is already cancelled");
  }
  if (job.opsStatus === "ready_for_billing") {
    throw new Error("Job ready for billing cannot be cancelled from orchestration");
  }
}

export function assertCanEscalate(job: ServiceExecution): void {
  if (job.opsStatus === "cancelled") {
    throw new Error("Cancelled job cannot be escalated");
  }
  if (job.isEscalated) {
    throw new Error("Job is already escalated");
  }
}

export function assertValidPriority(priority: string): asserts priority is JobPriority {
  if (!JOB_PRIORITIES.includes(priority as JobPriority)) {
    throw new Error(`Invalid priority "${priority}"`);
  }
}

export function assertAdminOpsActor(req: Request): void {
  const role = req.user?.role;
  if (role === "staff" || role === "customer") {
    throw new Error("Job orchestration actions require admin or manager permissions");
  }
}

export function actorFromReq(req: Request): { actorId: number | null; actorName: string | null } {
  return {
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? req.user?.phone ?? null,
  };
}
