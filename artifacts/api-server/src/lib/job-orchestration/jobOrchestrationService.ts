/**
 * Phase 5.5 — Job Orchestration service.
 * Job entity = service_executions (Architecture A). Does not own field performance.
 */

import type { Request } from "express";
import {
  db,
  serviceExecutionsTable,
  customersTable,
  staffTable,
  serviceLocationsTable,
  assetsTable,
  type JobOpsStatus,
  type JobPriority,
  type ServiceExecution,
} from "@workspace/db";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { tenantFilters, rowInScope } from "../../middlewares/tenantScope";
import { isTerminal } from "../executions/executionValidation";
import { recordExecutionTimeline } from "../executions/executionTimeline";
import {
  executionDomainEventPublisher,
  baseExecutionEventFields,
} from "../executions/domainEvents";
import {
  assertAdminOpsActor,
  assertCanApprove,
  assertCanCancel,
  assertCanEscalate,
  assertCanMarkReadyForBilling,
  assertCanReopen,
  assertValidPriority,
  actorFromReq,
  ACTIVE_OPS_STATUSES,
} from "./jobValidation";
import { recordJobTimeline, getOperationalTimeline } from "./jobTimeline";
import {
  jobDomainEventPublisher,
  baseJobEventFields,
} from "./domainEvents";

export type JobView = {
  id: number;
  jobId: number;
  executionId: number;
  serviceAssignmentId: number | null;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  locationLabel: string | null;
  assetId: number | null;
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
  opsCancelledAt: string | null;
  opsCancelReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  companyId: number | null;
  franchiseeId: number | null;
  branchId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type JobListFilter = {
  queue?: "active" | "completed" | "escalated" | "reopened" | "quality_review" | "ready_for_billing" | "all";
  priority?: JobPriority;
  opsStatus?: JobOpsStatus;
  limit?: number;
};

const jobSelect = {
  execution: serviceExecutionsTable,
  customerName: customersTable.name,
  staffName: staffTable.name,
  locationLabel: serviceLocationsTable.label,
  assetLabel: assetsTable.label,
};

function jobQuery() {
  return db.select(jobSelect)
    .from(serviceExecutionsTable)
    .innerJoin(customersTable, eq(serviceExecutionsTable.customerId, customersTable.id))
    .innerJoin(staffTable, eq(serviceExecutionsTable.assignedStaffId, staffTable.id))
    .leftJoin(serviceLocationsTable, eq(serviceExecutionsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(assetsTable, eq(serviceExecutionsTable.assetId, assetsTable.id));
}

function mapJob(row: {
  execution: ServiceExecution;
  customerName: string;
  staffName: string;
  locationLabel: string | null;
  assetLabel: string | null;
}): JobView {
  const e = row.execution;
  return {
    id: e.id,
    jobId: e.id,
    executionId: e.id,
    serviceAssignmentId: e.serviceAssignmentId,
    contractId: e.contractId,
    customerId: e.customerId,
    customerName: row.customerName,
    serviceLocationId: e.serviceLocationId,
    locationLabel: row.locationLabel,
    assetId: e.assetId,
    assetLabel: row.assetLabel,
    assignedStaffId: e.assignedStaffId,
    staffName: row.staffName,
    taskType: e.taskType,
    scheduledDate: e.scheduledDate,
    scheduledTime: e.scheduledTime,
    fieldStatus: e.status,
    opsStatus: e.opsStatus,
    priority: e.priority,
    dependsOnExecutionId: e.dependsOnExecutionId,
    isEscalated: e.isEscalated,
    escalationReason: e.escalationReason,
    escalatedAt: e.escalatedAt?.toISOString() ?? null,
    opsOwnerUserId: e.opsOwnerUserId,
    qualityReviewStartedAt: e.qualityReviewStartedAt?.toISOString() ?? null,
    approvedAt: e.approvedAt?.toISOString() ?? null,
    readyForBillingAt: e.readyForBillingAt?.toISOString() ?? null,
    reopenedAt: e.reopenedAt?.toISOString() ?? null,
    reopenReason: e.reopenReason,
    opsCancelledAt: e.opsCancelledAt?.toISOString() ?? null,
    opsCancelReason: e.opsCancelReason,
    startedAt: e.startedAt?.toISOString() ?? null,
    completedAt: e.completedAt?.toISOString() ?? null,
    companyId: e.companyId,
    franchiseeId: e.franchiseeId,
    branchId: e.branchId,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function assertInScope(req: Request, execution: ServiceExecution) {
  return rowInScope(req, {
    companyId: execution.companyId,
    branchId: execution.branchId,
    franchiseeId: execution.franchiseeId,
    customerId: execution.customerId,
    staffId: execution.assignedStaffId,
  });
}

async function loadJobRow(jobId: number) {
  const [row] = await jobQuery()
    .where(eq(serviceExecutionsTable.id, jobId))
    .limit(1);
  return row ?? null;
}

async function getMutableJob(req: Request, jobId: number): Promise<ServiceExecution> {
  const row = await loadJobRow(jobId);
  if (!row || !assertInScope(req, row.execution)) {
    throw new Error("Job not found");
  }
  return row.execution;
}

function eventBase(job: ServiceExecution, actorId: number | null | undefined) {
  return baseJobEventFields({
    jobId: job.id,
    executionId: job.id,
    contractId: job.contractId,
    customerId: job.customerId,
    staffId: job.assignedStaffId,
    actorId: actorId ?? null,
  });
}

async function assertDependencySatisfied(dependsOnExecutionId: number | null): Promise<void> {
  if (dependsOnExecutionId == null) return;
  const [dep] = await db.select().from(serviceExecutionsTable)
    .where(eq(serviceExecutionsTable.id, dependsOnExecutionId))
    .limit(1);
  if (!dep) {
    throw new Error("Dependency job not found");
  }
  if (dep.opsStatus !== "approved" && dep.opsStatus !== "ready_for_billing") {
    throw new Error(`Dependency job #${dependsOnExecutionId} is not approved yet`);
  }
}

/** Called from ExecutionCompleted subscriber — does not require HTTP actor. */
export async function enterQualityReviewFromFieldComplete(executionId: number): Promise<void> {
  const [job] = await db.select().from(serviceExecutionsTable)
    .where(eq(serviceExecutionsTable.id, executionId))
    .limit(1);
  if (!job) return;
  if (job.opsStatus === "cancelled" || job.opsStatus === "ready_for_billing") return;
  if (job.opsStatus === "pending_quality_review" || job.opsStatus === "approved") return;

  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      opsStatus: "pending_quality_review",
      qualityReviewStartedAt: now,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));

  await recordJobTimeline({
    executionId,
    eventType: "JOB_ENTERED_QUALITY_REVIEW",
    description: "Field execution completed — entered quality review",
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, null),
    type: "JobCompleted",
    metadata: { opsStatus: "pending_quality_review" },
  });
}

/** Sync ops cancel when Field Execution cancels (subscriber). */
export async function syncOpsCancelledFromField(
  executionId: number,
  reason?: string,
): Promise<void> {
  const [job] = await db.select().from(serviceExecutionsTable)
    .where(eq(serviceExecutionsTable.id, executionId))
    .limit(1);
  if (!job || job.opsStatus === "cancelled") return;

  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      opsStatus: "cancelled",
      opsCancelledAt: now,
      opsCancelReason: reason ?? job.cancellationReason ?? "Cancelled",
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));

  await recordJobTimeline({
    executionId,
    eventType: "JOB_CANCELLED",
    description: reason ?? "Cancelled from field execution",
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, null),
    type: "JobCancelled",
    metadata: { source: "field", reason },
  });
}

export async function listJobs(req: Request, filter: JobListFilter = {}): Promise<JobView[]> {
  const conditions: SQL[] = [
    ...tenantFilters(req, {
      companyCol: serviceExecutionsTable.companyId,
      branchCol: serviceExecutionsTable.branchId,
      franchiseeCol: serviceExecutionsTable.franchiseeId,
    }),
  ];

  const queue = filter.queue ?? "all";
  if (queue === "active") {
    conditions.push(inArray(serviceExecutionsTable.opsStatus, ACTIVE_OPS_STATUSES));
    conditions.push(sql`${serviceExecutionsTable.status} NOT IN ('cancelled', 'missed', 'rescheduled')`);
  } else if (queue === "completed") {
    conditions.push(eq(serviceExecutionsTable.status, "completed"));
  } else if (queue === "escalated") {
    conditions.push(eq(serviceExecutionsTable.isEscalated, true));
  } else if (queue === "reopened") {
    conditions.push(eq(serviceExecutionsTable.opsStatus, "reopened"));
  } else if (queue === "quality_review") {
    conditions.push(eq(serviceExecutionsTable.opsStatus, "pending_quality_review"));
  } else if (queue === "ready_for_billing") {
    conditions.push(eq(serviceExecutionsTable.opsStatus, "ready_for_billing"));
  }

  if (filter.priority) {
    conditions.push(eq(serviceExecutionsTable.priority, filter.priority));
  }
  if (filter.opsStatus) {
    conditions.push(eq(serviceExecutionsTable.opsStatus, filter.opsStatus));
  }

  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  const rows = await jobQuery()
    .where(and(...conditions))
    .orderBy(desc(serviceExecutionsTable.updatedAt))
    .limit(limit);

  return rows.map(mapJob);
}

export async function getJobDetail(req: Request, jobId: number): Promise<JobView | null> {
  const row = await loadJobRow(jobId);
  if (!row || !assertInScope(req, row.execution)) return null;
  return mapJob(row);
}

export async function getJobTimeline(req: Request, jobId: number) {
  const job = await getMutableJob(req, jobId);
  const timeline = await getOperationalTimeline(job.id);
  return timeline.map((t) => ({
    id: t.id,
    source: t.source,
    eventType: t.eventType,
    title: t.title,
    description: t.description,
    actorId: t.actorId,
    actorName: t.actorName,
    metadata: t.metadata,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function reopenJob(
  req: Request,
  jobId: number,
  reason?: string,
): Promise<JobView> {
  assertAdminOpsActor(req);
  const job = await getMutableJob(req, jobId);
  assertCanReopen(job);

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      status: "ready_for_execution",
      completedAt: null,
      startedAt: null,
      pausedAt: null,
      resumedAt: null,
      opsStatus: "reopened",
      reopenedAt: now,
      reopenReason: reason ?? "Reopened for rework",
      approvedAt: null,
      approvedBy: null,
      qualityReviewStartedAt: null,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, jobId));

  await recordJobTimeline({
    executionId: jobId,
    eventType: "JOB_REOPENED",
    description: reason ?? "Reopened for rework",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, actor.actorId),
    type: "JobReopened",
    metadata: { reason },
  });

  const view = await getJobDetail(req, jobId);
  return view!;
}

export async function escalateJob(
  req: Request,
  jobId: number,
  reason: string,
): Promise<JobView> {
  assertAdminOpsActor(req);
  const job = await getMutableJob(req, jobId);
  assertCanEscalate(job);
  if (!reason?.trim()) throw new Error("Escalation reason is required");

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      isEscalated: true,
      escalationReason: reason.trim(),
      escalatedAt: now,
      escalatedBy: actor.actorId,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, jobId));

  await recordJobTimeline({
    executionId: jobId,
    eventType: "JOB_ESCALATED",
    description: reason.trim(),
    actorId: actor.actorId,
    actorName: actor.actorName,
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, actor.actorId),
    type: "JobEscalated",
    metadata: { reason: reason.trim() },
  });

  return (await getJobDetail(req, jobId))!;
}

export async function changeJobPriority(
  req: Request,
  jobId: number,
  priority: string,
): Promise<JobView> {
  assertAdminOpsActor(req);
  assertValidPriority(priority);
  const job = await getMutableJob(req, jobId);
  if (job.opsStatus === "cancelled") {
    throw new Error("Cannot change priority on cancelled job");
  }

  const actor = actorFromReq(req);
  const previous = job.priority;
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({ priority: priority as JobPriority, updatedAt: now })
    .where(eq(serviceExecutionsTable.id, jobId));

  await recordJobTimeline({
    executionId: jobId,
    eventType: "JOB_PRIORITY_CHANGED",
    description: `Priority ${previous} → ${priority}`,
    actorId: actor.actorId,
    actorName: actor.actorName,
    metadata: { from: previous, to: priority },
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, actor.actorId),
    type: "JobPriorityChanged",
    metadata: { from: previous, to: priority },
  });

  return (await getJobDetail(req, jobId))!;
}

export async function approveJob(req: Request, jobId: number, notes?: string): Promise<JobView> {
  assertAdminOpsActor(req);
  const job = await getMutableJob(req, jobId);
  assertCanApprove(job);
  await assertDependencySatisfied(job.dependsOnExecutionId);

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      opsStatus: "approved",
      approvedAt: now,
      approvedBy: actor.actorId,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, jobId));

  await recordJobTimeline({
    executionId: jobId,
    eventType: "JOB_APPROVED",
    description: notes ?? "Quality review approved",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, actor.actorId),
    type: "JobApproved",
    metadata: { notes },
  });

  return (await getJobDetail(req, jobId))!;
}

export async function markJobReadyForBilling(req: Request, jobId: number): Promise<JobView> {
  assertAdminOpsActor(req);
  const job = await getMutableJob(req, jobId);
  assertCanMarkReadyForBilling(job);

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      opsStatus: "ready_for_billing",
      readyForBillingAt: now,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, jobId));

  await recordJobTimeline({
    executionId: jobId,
    eventType: "JOB_READY_FOR_BILLING",
    description: "Marked ready for billing (billing not performed here)",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, actor.actorId),
    type: "JobReadyForBilling",
  });

  return (await getJobDetail(req, jobId))!;
}

export async function cancelJob(
  req: Request,
  jobId: number,
  reason?: string,
): Promise<JobView> {
  assertAdminOpsActor(req);
  const job = await getMutableJob(req, jobId);
  assertCanCancel(job);

  const actor = actorFromReq(req);
  const now = new Date();
  const cancelReason = reason?.trim() || "Cancelled by operations";

  // Ops-owned cancel: update field status when still non-terminal without calling
  // Field Execution service (frozen). Mirror cancel side-effects for consistency.
  if (!isTerminal(job.status)) {
    await db.update(serviceExecutionsTable)
      .set({
        status: "cancelled",
        cancellationReason: cancelReason,
        opsStatus: "cancelled",
        opsCancelledAt: now,
        opsCancelReason: cancelReason,
        updatedAt: now,
      })
      .where(eq(serviceExecutionsTable.id, jobId));

    await recordExecutionTimeline({
      executionId: jobId,
      eventType: "EXECUTION_CANCELLED",
      description: cancelReason,
      actorId: actor.actorId,
      actorName: actor.actorName,
    });
    executionDomainEventPublisher.publish({
      ...baseExecutionEventFields({
        executionId: jobId,
        serviceAssignmentId: job.serviceAssignmentId,
        contractId: job.contractId,
        customerId: job.customerId,
        staffId: job.assignedStaffId,
        actorId: actor.actorId,
      }),
      type: "ExecutionCancelled",
      metadata: { reason: cancelReason, source: "orchestration" },
    });
  } else {
    await db.update(serviceExecutionsTable)
      .set({
        opsStatus: "cancelled",
        opsCancelledAt: now,
        opsCancelReason: cancelReason,
        updatedAt: now,
      })
      .where(eq(serviceExecutionsTable.id, jobId));
  }

  await recordJobTimeline({
    executionId: jobId,
    eventType: "JOB_CANCELLED",
    description: cancelReason,
    actorId: actor.actorId,
    actorName: actor.actorName,
  });

  jobDomainEventPublisher.publish({
    ...eventBase(job, actor.actorId),
    type: "JobCancelled",
    metadata: { reason: cancelReason, source: "orchestration" },
  });

  return (await getJobDetail(req, jobId))!;
}

export async function changeJobOwnership(
  req: Request,
  jobId: number,
  opsOwnerUserId: number | null,
): Promise<JobView> {
  assertAdminOpsActor(req);
  const job = await getMutableJob(req, jobId);
  if (job.opsStatus === "cancelled") {
    throw new Error("Cannot change ownership on cancelled job");
  }

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({ opsOwnerUserId, updatedAt: now })
    .where(eq(serviceExecutionsTable.id, jobId));

  await recordJobTimeline({
    executionId: jobId,
    eventType: "JOB_OWNERSHIP_CHANGED",
    description: opsOwnerUserId == null
      ? "Operational ownership cleared"
      : `Operational owner set to user #${opsOwnerUserId}`,
    actorId: actor.actorId,
    actorName: actor.actorName,
    metadata: { from: job.opsOwnerUserId, to: opsOwnerUserId },
  });

  return (await getJobDetail(req, jobId))!;
}

export async function setJobDependency(
  req: Request,
  jobId: number,
  dependsOnExecutionId: number | null,
): Promise<JobView> {
  assertAdminOpsActor(req);
  const job = await getMutableJob(req, jobId);
  if (job.opsStatus === "cancelled" || job.opsStatus === "ready_for_billing") {
    throw new Error("Cannot change dependency in current status");
  }
  if (dependsOnExecutionId != null) {
    if (dependsOnExecutionId === jobId) {
      throw new Error("Job cannot depend on itself");
    }
    await getMutableJob(req, dependsOnExecutionId);
  }

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({ dependsOnExecutionId, updatedAt: now })
    .where(eq(serviceExecutionsTable.id, jobId));

  await recordJobTimeline({
    executionId: jobId,
    eventType: dependsOnExecutionId == null ? "JOB_DEPENDENCY_CLEARED" : "JOB_DEPENDENCY_SET",
    description: dependsOnExecutionId == null
      ? "Dependency cleared"
      : `Depends on job #${dependsOnExecutionId}`,
    actorId: actor.actorId,
    actorName: actor.actorName,
    metadata: { dependsOnExecutionId },
  });

  return (await getJobDetail(req, jobId))!;
}
