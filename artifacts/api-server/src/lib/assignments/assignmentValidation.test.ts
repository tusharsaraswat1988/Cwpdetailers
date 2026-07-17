import { describe, expect, it } from "vitest";
import { assertStaffAssignable, assertStaffBranchMatch } from "./assignmentValidation";
import {
  assignmentDomainEventPublisher,
  baseAssignmentEventFields,
  type AssignmentDomainEvent,
} from "./domainEvents";

function staffFixture(overrides: Partial<{
  id: number;
  isActive: boolean;
  verificationStatus: string;
  branchId: number | null;
}> = {}) {
  return {
    id: 1,
    name: "Test Staff",
    phone: "9000000001",
    employeeCode: "E1",
    isActive: true,
    verificationStatus: "verified",
    branchId: 10,
    companyId: 1,
    franchiseeId: null,
    ...overrides,
  } as Parameters<typeof assertStaffAssignable>[0];
}

describe("Phase 5.3 assignment validation", () => {
  it("rejects missing staff", () => {
    expect(() => assertStaffAssignable(null)).toThrow(/not found/i);
  });

  it("rejects inactive staff", () => {
    expect(() => assertStaffAssignable(staffFixture({ isActive: false }))).toThrow(/inactive/i);
  });

  it("rejects suspended staff", () => {
    expect(() => assertStaffAssignable(staffFixture({ verificationStatus: "suspended" }))).toThrow(/suspended/i);
  });

  it("accepts active staff", () => {
    expect(() => assertStaffAssignable(staffFixture())).not.toThrow();
  });

  it("rejects cross-branch assignment when job branch is set", () => {
    expect(() => assertStaffBranchMatch(staffFixture({ branchId: 10 }), 20)).toThrow(/different branch/i);
  });

  it("allows same-branch assignment", () => {
    expect(() => assertStaffBranchMatch(staffFixture({ branchId: 10 }), 10)).not.toThrow();
  });

  it("skips branch check when job has no branch", () => {
    expect(() => assertStaffBranchMatch(staffFixture({ branchId: 10 }), null)).not.toThrow();
  });
});

describe("Phase 5.3 assignment domain events", () => {
  it("publishes AssignmentCreated / Changed / Removed", () => {
    const seen: AssignmentDomainEvent[] = [];
    const unsub = assignmentDomainEventPublisher.subscribe((e) => seen.push(e));
    try {
      const base = baseAssignmentEventFields({
        assignmentId: 1,
        pendingAssignmentId: 2,
        contractId: 3,
        customerId: 4,
        staffId: 5,
        taskType: "one_time_service",
        actorId: 9,
      });
      assignmentDomainEventPublisher.publish({ ...base, type: "AssignmentCreated", staffId: 5 });
      assignmentDomainEventPublisher.publish({
        ...base,
        type: "AssignmentChanged",
        staffId: 6,
        previousStaffId: 5,
      });
      assignmentDomainEventPublisher.publish({
        ...base,
        type: "AssignmentRemoved",
        previousStaffId: 6,
      });
      expect(seen.map((e) => e.type)).toEqual([
        "AssignmentCreated",
        "AssignmentChanged",
        "AssignmentRemoved",
      ]);
    } finally {
      unsub();
      assignmentDomainEventPublisher.clearSubscribers();
    }
  });
});
