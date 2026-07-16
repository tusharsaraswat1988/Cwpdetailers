import type { BookingPolicy, BookingPolicyContext, PolicyResult } from "./types";

export type AssignmentPolicyInput = {
  staffId?: number | null;
  serviceType: string;
  staffRoleValid?: boolean;
  staffRoleError?: string | null;
};

export const assignmentPolicy: BookingPolicy<AssignmentPolicyInput, PolicyResult> = {
  name: "AssignmentPolicy",
  async execute(input, _ctx) {
    if (!input.staffId) return { success: true, metadata: { skipped: true } };
    if (input.staffRoleError) {
      return { success: false, error: input.staffRoleError };
    }
    if (input.staffRoleValid === false) {
      return { success: false, error: "Staff cannot be assigned to this service type" };
    }
    return { success: true, metadata: { staffId: input.staffId } };
  },
};

export type SchedulingPolicyInput = {
  scheduledDate: string;
  scheduledTime?: string | null;
  recurrenceRule?: string | null;
};

export const schedulingPolicy: BookingPolicy<SchedulingPolicyInput, PolicyResult> = {
  name: "SchedulingPolicy",
  async execute(input, _ctx) {
    if (!input.scheduledDate) {
      return { success: false, error: "scheduledDate is required" };
    }
    const date = new Date(input.scheduledDate);
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Invalid scheduledDate" };
    }
    return { success: true, metadata: { scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime } };
  },
};

export type CancellationPolicyInput = {
  currentStatus: string;
  reason?: string;
};

export const cancellationPolicy: BookingPolicy<CancellationPolicyInput, PolicyResult> = {
  name: "CancellationPolicy",
  async execute(input, _ctx) {
    const cancellable = ["pending", "confirmed", "scheduled", "rescheduled"];
    if (!cancellable.includes(input.currentStatus)) {
      return { success: false, error: `Cannot cancel booking in status ${input.currentStatus}` };
    }
    return { success: true };
  },
};

export type CompletionPolicyInput = {
  proofPhotoUrls?: string[];
  afterPhotoUrl?: string | null;
};

export const completionPolicy: BookingPolicy<CompletionPolicyInput, PolicyResult> = {
  name: "CompletionPolicy",
  async execute(input, _ctx) {
    const proof = input.proofPhotoUrls ?? [];
    const hasMultiPhotoProof = proof.length >= 6;
    if (!hasMultiPhotoProof && !input.afterPhotoUrl) {
      return {
        success: false,
        error: "Upload 3 before and 3 after geo-tagged photos before completing the job",
      };
    }
    return { success: true };
  },
};

export type ReviewPolicyInput = {
  rating?: number;
};

export const reviewPolicy: BookingPolicy<ReviewPolicyInput, PolicyResult> = {
  name: "ReviewPolicy",
  async execute(input, _ctx) {
    if (input.rating != null && (input.rating < 1 || input.rating > 5)) {
      return { success: false, error: "Rating must be between 1 and 5" };
    }
    return { success: true };
  },
};

export type PaymentPolicyInput = {
  amount?: string | null;
  entitlementId?: number | null;
  requiresPayment?: boolean;
};

export const paymentPolicy: BookingPolicy<PaymentPolicyInput, PolicyResult> = {
  name: "PaymentPolicy",
  async execute(input, _ctx) {
    if (input.entitlementId) return { success: true, metadata: { waived: true } };
    if (input.requiresPayment && (!input.amount || input.amount === "0")) {
      return { success: false, error: "Payment required for this booking" };
    }
    return { success: true, metadata: { amount: input.amount } };
  },
};
