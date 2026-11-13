import type { BookingStatus } from "@workspace/db";

/** Core service operations lifecycle statuses (PRD v4.5 / Phase 16). */
export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "draft",
  "scheduled",
  "confirmed",
  "waiting_assignment",
  "assigned",
  "in_progress",
  "completed",
  "missed",
  "rescheduled",
  "cancelled",
] as const;

/** Valid transitions across full booking-to-execution service lifecycle. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["scheduled", "confirmed", "cancelled"],
  scheduled: ["confirmed", "waiting_assignment", "rescheduled", "cancelled"],
  confirmed: ["waiting_assignment", "assigned", "rescheduled", "cancelled"],
  waiting_assignment: ["assigned", "rescheduled", "cancelled"],
  assigned: ["assigned", "in_progress", "waiting_assignment", "rescheduled", "cancelled", "missed"],
  in_progress: ["completed", "missed", "cancelled"],
  completed: [],
  missed: ["rescheduled", "waiting_assignment", "cancelled"],
  rescheduled: ["confirmed", "waiting_assignment", "assigned", "cancelled"],
  cancelled: [],
};

export class BookingStateMachineError extends Error {
  constructor(
    message: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(message);
    this.name = "BookingStateMachineError";
  }
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return (BOOKING_TRANSITIONS[from] ?? []).includes(to);
}

export function validateTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new BookingStateMachineError(
      `Invalid booking transition from ${from} to ${to}`,
      from,
      to,
    );
  }
}

export function isTerminalStatus(status: BookingStatus): boolean {
  return status === "cancelled" || status === "completed";
}

export function isActiveScheduleStatus(status: BookingStatus): boolean {
  return status !== "cancelled" && status !== "completed";
}

/** Statuses that occupy a calendar slot for conflict/capacity checks. */
export const SLOT_OCCUPYING_STATUSES: readonly BookingStatus[] = [
  "draft",
  "scheduled",
  "confirmed",
  "waiting_assignment",
  "assigned",
  "in_progress",
  "rescheduled",
];
