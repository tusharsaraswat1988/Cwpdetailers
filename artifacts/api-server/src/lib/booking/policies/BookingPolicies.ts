import type { BookingPolicy, PolicyResult } from "./types";

export type SchedulingPolicyInput = {
  scheduledDate: string;
  scheduledTime?: string | null;
};

export const schedulingPolicy: BookingPolicy<SchedulingPolicyInput, PolicyResult> = {
  name: "SchedulingPolicy",
  async execute(input) {
    if (!input.scheduledDate) {
      return { success: false, error: "scheduledDate is required" };
    }
    const date = new Date(input.scheduledDate);
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Invalid scheduledDate" };
    }
    return {
      success: true,
      metadata: { scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime },
    };
  },
};

export type CancellationPolicyInput = {
  currentStatus: string;
  reason?: string;
};

const CANCELLABLE = ["draft", "scheduled", "confirmed", "waiting_assignment", "rescheduled"];

export const cancellationPolicy: BookingPolicy<CancellationPolicyInput, PolicyResult> = {
  name: "CancellationPolicy",
  async execute(input) {
    if (!CANCELLABLE.includes(input.currentStatus)) {
      return { success: false, error: `Cannot cancel booking in status ${input.currentStatus}` };
    }
    return { success: true };
  },
};

/** @deprecated Assignment is owned by Assignment platform — stub kept for import compat. */
export const assignmentPolicy: BookingPolicy<{ staffId?: number | null }, PolicyResult> = {
  name: "AssignmentPolicy",
  async execute() {
    return { success: false, error: "Staff assignment is not owned by Booking Engine (Phase 5.3+)" };
  },
};

/** @deprecated Completion is owned by Execution — stub kept for import compat. */
export const completionPolicy: BookingPolicy<Record<string, unknown>, PolicyResult> = {
  name: "CompletionPolicy",
  async execute() {
    return { success: false, error: "Job completion is not owned by Booking Engine" };
  },
};

/** @deprecated */
export const reviewPolicy: BookingPolicy<{ rating?: number }, PolicyResult> = {
  name: "ReviewPolicy",
  async execute() {
    return { success: true, metadata: { skipped: true } };
  },
};

/** @deprecated Pricing is not owned by Booking Engine. */
export const paymentPolicy: BookingPolicy<Record<string, unknown>, PolicyResult> = {
  name: "PaymentPolicy",
  async execute() {
    return { success: true, metadata: { skipped: true } };
  },
};
