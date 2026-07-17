import { describe, expect, it } from "vitest";
import {
  assertCanApprove,
  assertCanCancel,
  assertCanEscalate,
  assertCanMarkReadyForBilling,
  assertCanReopen,
  assertValidPriority,
  assertAdminOpsActor,
  isJobOpsCancelled,
  isJobReadyForBilling,
} from "./jobValidation";
import {
  jobDomainEventPublisher,
  baseJobEventFields,
  type JobDomainEvent,
} from "./domainEvents";
import type { Request } from "express";
import type { ServiceExecution } from "@workspace/db";

function job(overrides: Partial<ServiceExecution> = {}): ServiceExecution {
  return {
    id: 1,
    serviceAssignmentId: 10,
    contractId: 2,
    customerId: 3,
    serviceLocationId: null,
    assetId: null,
    assignedStaffId: 4,
    taskType: "one_time_service",
    isSubstitute: false,
    substituteForStaffId: null,
    scheduledDate: "2026-07-17",
    scheduledTime: null,
    status: "completed",
    startedAt: null,
    pausedAt: null,
    resumedAt: null,
    completedAt: new Date(),
    customerSignatureUrl: null,
    customerSignedAt: null,
    cancellationReason: null,
    rescheduledFromId: null,
    opsStatus: "pending_quality_review",
    priority: "normal",
    dependsOnExecutionId: null,
    isEscalated: false,
    escalationReason: null,
    escalatedAt: null,
    escalatedBy: null,
    opsOwnerUserId: null,
    qualityReviewStartedAt: new Date(),
    approvedAt: null,
    approvedBy: null,
    readyForBillingAt: null,
    reopenedAt: null,
    reopenReason: null,
    opsCancelledAt: null,
    opsCancelReason: null,
    legacyBookingId: null,
    legacyDcmsVisitId: null,
    companyId: 1,
    franchiseeId: null,
    branchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ServiceExecution;
}

describe("Phase 5.5 job orchestration validation", () => {
  it("allows reopen from quality review when field completed", () => {
    expect(() => assertCanReopen(job())).not.toThrow();
  });

  it("allows reopen from approved", () => {
    expect(() => assertCanReopen(job({ opsStatus: "approved" }))).not.toThrow();
  });

  it("rejects reopen when not field-completed", () => {
    expect(() => assertCanReopen(job({ status: "started", opsStatus: "reopened" }))).toThrow(/field-completed/i);
  });

  it("rejects reopen when ready for billing", () => {
    expect(() => assertCanReopen(job({ opsStatus: "ready_for_billing" }))).toThrow(/ready for billing/i);
  });

  it("allows approve from pending quality review", () => {
    expect(() => assertCanApprove(job())).not.toThrow();
  });

  it("rejects approve when not in quality review", () => {
    expect(() => assertCanApprove(job({ opsStatus: "in_field", status: "started" }))).toThrow(/quality review/i);
  });

  it("allows ready-for-billing only from approved", () => {
    expect(() => assertCanMarkReadyForBilling(job({ opsStatus: "approved" }))).not.toThrow();
    expect(() => assertCanMarkReadyForBilling(job())).toThrow(/approved/i);
  });

  it("allows escalate when not already escalated", () => {
    expect(() => assertCanEscalate(job())).not.toThrow();
    expect(() => assertCanEscalate(job({ isEscalated: true }))).toThrow(/already escalated/i);
  });

  it("rejects cancel when already cancelled or ready for billing", () => {
    expect(() => assertCanCancel(job({ opsStatus: "cancelled" }))).toThrow(/already cancelled/i);
    expect(() => assertCanCancel(job({ opsStatus: "ready_for_billing" }))).toThrow(/ready for billing/i);
  });

  it("validates priority values", () => {
    expect(() => assertValidPriority("urgent")).not.toThrow();
    expect(() => assertValidPriority("critical")).toThrow(/Invalid priority/i);
  });

  it("blocks staff from orchestration actions", () => {
    const req = { user: { role: "staff", id: 1 } } as unknown as Request;
    expect(() => assertAdminOpsActor(req)).toThrow(/admin or manager/i);
  });

  it("allows admin orchestration actor", () => {
    const req = { user: { role: "admin", id: 1 } } as unknown as Request;
    expect(() => assertAdminOpsActor(req)).not.toThrow();
  });

  it("detects terminal ops statuses", () => {
    expect(isJobOpsCancelled("cancelled")).toBe(true);
    expect(isJobReadyForBilling("ready_for_billing")).toBe(true);
    expect(isJobReadyForBilling("approved")).toBe(false);
  });
});

describe("Phase 5.5 job domain events", () => {
  it("publishes orchestration lifecycle events", () => {
    const seen: JobDomainEvent[] = [];
    const unsub = jobDomainEventPublisher.subscribe((e) => seen.push(e));
    try {
      const base = baseJobEventFields({
        jobId: 1,
        executionId: 1,
        contractId: 2,
        customerId: 3,
        staffId: 4,
      });
      jobDomainEventPublisher.publish({ ...base, type: "JobCompleted" });
      jobDomainEventPublisher.publish({ ...base, type: "JobReopened" });
      jobDomainEventPublisher.publish({ ...base, type: "JobEscalated" });
      jobDomainEventPublisher.publish({ ...base, type: "JobApproved" });
      jobDomainEventPublisher.publish({ ...base, type: "JobCancelled" });
      expect(seen.map((e) => e.type)).toEqual([
        "JobCompleted",
        "JobReopened",
        "JobEscalated",
        "JobApproved",
        "JobCancelled",
      ]);
    } finally {
      unsub();
      jobDomainEventPublisher.clearSubscribers();
    }
  });
});
