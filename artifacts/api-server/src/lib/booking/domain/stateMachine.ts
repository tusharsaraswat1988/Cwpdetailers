import type { BookingStatus } from "@workspace/db";

/** Phase 5.2 schedule-only statuses. */
export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "draft",
  "scheduled",
  "confirmed",
  "waiting_assignment",
  "rescheduled",
  "cancelled",
] as const;

/** Valid transitions — Booking ends at waiting_assignment (Assignment owns staff). */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["scheduled", "confirmed", "cancelled"],
  scheduled: ["confirmed", "waiting_assignment", "rescheduled", "cancelled"],
  confirmed: ["waiting_assignment", "rescheduled", "cancelled"],
  waiting_assignment: ["rescheduled", "cancelled"],
  rescheduled: ["confirmed", "waiting_assignment", "cancelled"],
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
  return status === "cancelled";
}

export function isActiveScheduleStatus(status: BookingStatus): boolean {
  return status !== "cancelled";
}

/** Statuses that occupy a calendar slot for conflict/capacity checks. */
export const SLOT_OCCUPYING_STATUSES: readonly BookingStatus[] = [
  "draft",
  "scheduled",
  "confirmed",
  "waiting_assignment",
  "rescheduled",
];
