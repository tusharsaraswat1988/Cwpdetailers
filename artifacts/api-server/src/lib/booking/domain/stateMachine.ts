import type { BookingPlatformStatus } from "@workspace/db";

/** Platform state machine statuses. */
export const BOOKING_PLATFORM_STATUSES: readonly BookingPlatformStatus[] = [
  "DRAFT", "VALIDATED", "CONFIRMED", "PAYMENT_PENDING", "ASSIGNED", "ACCEPTED",
  "TRAVELLING", "ARRIVED", "STARTED", "PAUSED", "RESUMED", "COMPLETED",
  "CANCELLED", "FAILED", "REVIEW_PENDING", "REVIEWED", "ARCHIVED",
] as const;

/** Valid platform transitions — every transition is validated and audited. */
export const PLATFORM_TRANSITIONS: Record<BookingPlatformStatus, BookingPlatformStatus[]> = {
  DRAFT: ["VALIDATED", "CANCELLED"],
  VALIDATED: ["CONFIRMED", "PAYMENT_PENDING", "CANCELLED", "FAILED"],
  CONFIRMED: ["PAYMENT_PENDING", "ASSIGNED", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "ASSIGNED", "CANCELLED", "FAILED"],
  ASSIGNED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["TRAVELLING", "CANCELLED"],
  TRAVELLING: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["STARTED", "CANCELLED"],
  STARTED: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["RESUMED", "CANCELLED"],
  RESUMED: ["PAUSED", "COMPLETED", "CANCELLED"],
  COMPLETED: ["REVIEW_PENDING", "ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  FAILED: ["ARCHIVED", "DRAFT"],
  REVIEW_PENDING: ["REVIEWED", "ARCHIVED"],
  REVIEWED: ["ARCHIVED"],
  ARCHIVED: [],
};

/** Legacy booking_status → platform_status mapping for backward compatibility. */
export const LEGACY_TO_PLATFORM: Record<string, BookingPlatformStatus> = {
  pending: "DRAFT",
  scheduled: "CONFIRMED",
  confirmed: "CONFIRMED",
  en_route: "TRAVELLING",
  in_progress: "STARTED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  rescheduled: "CONFIRMED",
  missed: "FAILED",
};

/** Platform status → legacy booking_status for API compatibility. */
export const PLATFORM_TO_LEGACY: Record<BookingPlatformStatus, string> = {
  DRAFT: "pending",
  VALIDATED: "pending",
  CONFIRMED: "confirmed",
  PAYMENT_PENDING: "confirmed",
  ASSIGNED: "scheduled",
  ACCEPTED: "confirmed",
  TRAVELLING: "en_route",
  ARRIVED: "en_route",
  STARTED: "in_progress",
  PAUSED: "in_progress",
  RESUMED: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "missed",
  REVIEW_PENDING: "completed",
  REVIEWED: "completed",
  ARCHIVED: "completed",
};

/** Legacy transition map — preserved for existing API consumers. */
export const LEGACY_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["confirmed", "cancelled", "rescheduled"],
  confirmed: ["en_route", "cancelled"],
  en_route: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rescheduled: ["confirmed", "en_route", "cancelled"],
  pending: ["confirmed", "cancelled"],
};

/** Legacy status → platform status for transition routing. */
export const LEGACY_TRANSITION_TO_PLATFORM: Record<string, BookingPlatformStatus> = {
  confirmed: "CONFIRMED",
  en_route: "TRAVELLING",
  in_progress: "STARTED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  rescheduled: "CONFIRMED",
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

export function canTransitionPlatform(
  from: BookingPlatformStatus,
  to: BookingPlatformStatus,
): boolean {
  return (PLATFORM_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionLegacy(from: string, to: string): boolean {
  return (LEGACY_TRANSITIONS[from] ?? []).includes(to);
}

export function validatePlatformTransition(
  from: BookingPlatformStatus,
  to: BookingPlatformStatus,
): void {
  if (!canTransitionPlatform(from, to)) {
    throw new BookingStateMachineError(
      `Invalid platform transition from ${from} to ${to}`,
      from,
      to,
    );
  }
}

export function validateLegacyTransition(from: string, to: string): void {
  if (!canTransitionLegacy(from, to)) {
    throw new BookingStateMachineError(
      `Invalid legacy transition from ${from} to ${to}`,
      from,
      to,
    );
  }
}

export function resolvePlatformStatus(
  legacyStatus: string,
  platformStatus?: BookingPlatformStatus | null,
): BookingPlatformStatus {
  if (platformStatus) return platformStatus;
  return LEGACY_TO_PLATFORM[legacyStatus] ?? "DRAFT";
}

export function resolveLegacyStatus(
  platformStatus: BookingPlatformStatus,
  currentLegacy?: string,
): string {
  if (platformStatus === "CONFIRMED" && currentLegacy === "scheduled") {
    return "scheduled";
  }
  if (platformStatus === "CONFIRMED" && currentLegacy === "rescheduled") {
    return "rescheduled";
  }
  return PLATFORM_TO_LEGACY[platformStatus] ?? currentLegacy ?? "pending";
}

export function mapLegacyTransitionToPlatform(legacyTo: string): BookingPlatformStatus {
  return LEGACY_TRANSITION_TO_PLATFORM[legacyTo] ?? LEGACY_TO_PLATFORM[legacyTo] ?? "CONFIRMED";
}

export function isTerminalPlatformStatus(status: BookingPlatformStatus): boolean {
  return status === "ARCHIVED" || status === "CANCELLED";
}

export function isTerminalLegacyStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}
