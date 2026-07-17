import { describe, expect, it } from "vitest";
import {
  assertAssignedTechnician,
  assertNotCompleted,
  isReady,
  isInProgress,
  isTerminal,
} from "./executionValidation";
import {
  executionDomainEventPublisher,
  baseExecutionEventFields,
  type ExecutionDomainEvent,
} from "./domainEvents";
import type { Request } from "express";

function exec(overrides: Partial<{ status: string; assignedStaffId: number }> = {}) {
  return {
    id: 1,
    status: "ready_for_execution",
    assignedStaffId: 10,
    ...overrides,
  } as Parameters<typeof assertNotCompleted>[0];
}

describe("Phase 5.4 execution validation", () => {
  it("treats ready_for_execution and scheduled as ready", () => {
    expect(isReady("ready_for_execution")).toBe(true);
    expect(isReady("scheduled")).toBe(true);
    expect(isReady("started")).toBe(false);
  });

  it("treats started and resumed as in progress", () => {
    expect(isInProgress("started")).toBe(true);
    expect(isInProgress("resumed")).toBe(true);
    expect(isInProgress("paused")).toBe(false);
  });

  it("rejects completed jobs", () => {
    expect(() => assertNotCompleted(exec({ status: "completed" }))).toThrow(/already completed/i);
  });

  it("rejects wrong technician for staff role", () => {
    const req = {
      user: { role: "staff", id: 1, staffId: 99 },
      scope: { staffId: 99 },
    } as unknown as Request;
    expect(() => assertAssignedTechnician(req, exec({ assignedStaffId: 10 }))).toThrow(/Wrong technician/i);
  });

  it("allows matching technician", () => {
    const req = {
      user: { role: "staff", id: 1, staffId: 10 },
      scope: { staffId: 10 },
    } as unknown as Request;
    expect(() => assertAssignedTechnician(req, exec({ assignedStaffId: 10 }))).not.toThrow();
  });

  it("allows admin without staff match", () => {
    const req = {
      user: { role: "admin", id: 1 },
      scope: {},
    } as unknown as Request;
    expect(() => assertAssignedTechnician(req, exec({ assignedStaffId: 10 }))).not.toThrow();
  });

  it("marks terminal statuses", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("started")).toBe(false);
  });
});

describe("Phase 5.4 execution domain events", () => {
  it("publishes lifecycle events", () => {
    const seen: ExecutionDomainEvent[] = [];
    const unsub = executionDomainEventPublisher.subscribe((e) => seen.push(e));
    try {
      const base = baseExecutionEventFields({
        executionId: 1,
        contractId: 2,
        customerId: 3,
        staffId: 4,
      });
      executionDomainEventPublisher.publish({ ...base, type: "ExecutionStarted" });
      executionDomainEventPublisher.publish({ ...base, type: "ExecutionPaused" });
      executionDomainEventPublisher.publish({ ...base, type: "ExecutionResumed" });
      executionDomainEventPublisher.publish({ ...base, type: "ExecutionCompleted" });
      expect(seen.map((e) => e.type)).toEqual([
        "ExecutionStarted",
        "ExecutionPaused",
        "ExecutionResumed",
        "ExecutionCompleted",
      ]);
    } finally {
      unsub();
      executionDomainEventPublisher.clearSubscribers();
    }
  });
});
