/**
 * Phase 5.4 — Field Execution validation helpers.
 * Does NOT validate attendance, routes, billing, or inventory.
 */

import type { Request } from "express";
import type { serviceAssignmentsTable, serviceExecutionsTable } from "@workspace/db";

type ExecutionRow = typeof serviceExecutionsTable.$inferSelect;
type AssignmentRow = typeof serviceAssignmentsTable.$inferSelect;

export type FieldExecutionStatus =
  | "scheduled"
  | "ready_for_execution"
  | "started"
  | "paused"
  | "resumed"
  | "completed"
  | "missed"
  | "cancelled"
  | "rescheduled";

export const TERMINAL_STATUSES: FieldExecutionStatus[] = [
  "completed", "missed", "cancelled", "rescheduled",
];

export const READY_STATUSES: FieldExecutionStatus[] = [
  "ready_for_execution", "scheduled",
];

export const IN_PROGRESS_STATUSES: FieldExecutionStatus[] = [
  "started", "resumed",
];

export const WORKABLE_STATUSES: FieldExecutionStatus[] = [
  "started", "resumed", "paused",
];

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as FieldExecutionStatus);
}

export function isReady(status: string): boolean {
  return READY_STATUSES.includes(status as FieldExecutionStatus);
}

export function isInProgress(status: string): boolean {
  return IN_PROGRESS_STATUSES.includes(status as FieldExecutionStatus);
}

export function assertNotCompleted(execution: ExecutionRow): void {
  if (execution.status === "completed") {
    throw new Error("Job is already completed");
  }
  if (isTerminal(execution.status)) {
    throw new Error(`Execution is already ${execution.status}`);
  }
}

/**
 * Staff portal: acting technician must match assigned staff.
 * Admin/super-admin may act without staff match when not scoped as staff.
 */
export function assertAssignedTechnician(
  req: Request,
  execution: ExecutionRow,
): void {
  if (req.user?.role !== "staff") return;
  const staffId = req.scope?.staffId ?? req.user.staffId;
  if (staffId == null) {
    throw new Error("Staff identity required to perform this action");
  }
  if (staffId !== execution.assignedStaffId) {
    throw new Error("Wrong technician — this job is assigned to a different staff member");
  }
}

/**
 * Linked assignment must be active (ready_for_execution or assigned).
 * Does not mutate assignment (Phase 5.3 frozen).
 */
export function assertAssignmentAllowsExecution(
  assignment: AssignmentRow | null | undefined,
): void {
  if (!assignment) return;
  if (assignment.status === "removed") {
    throw new Error("Linked assignment was removed — cannot execute");
  }
  if (assignment.status !== "ready_for_execution" && assignment.status !== "assigned") {
    throw new Error(`Assignment status "${assignment.status}" does not allow execution`);
  }
}

export function actorFromReq(req: Request): { actorId: number | null; actorName: string | null } {
  return {
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? req.user?.phone ?? null,
  };
}
