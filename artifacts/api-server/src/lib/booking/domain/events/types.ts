import type { BookingTraceContext } from "../../correlation/BookingTraceContext";
import { BOOKING_DOMAIN_VERSION } from "../../versioning";
import type { BookingContext } from "../../BookingContext";

/**
 * Phase 5.2 schedule-owned domain events (required).
 * Field-ops / payment events retained as deprecated aliases for gradual cleanup —
 * Booking Engine does not publish them.
 */
export type BookingDomainEventType =
  | "BookingCreated"
  | "BookingScheduled"
  | "BookingConfirmed"
  | "BookingRescheduled"
  | "BookingCancelled"
  /** @deprecated Not owned by Booking Engine (Phase 5.2 freeze). */
  | "BookingValidated"
  | "BookingAssigned"
  | "BookingAccepted"
  | "BookingStarted"
  | "BookingPaused"
  | "BookingResumed"
  | "BookingCompleted"
  | "BookingFailed"
  | "BookingReviewed"
  | "BookingArchived"
  | "BookingAddressChanged"
  | "BookingSnapshotCreated"
  | "BookingPaymentPending"
  | "BookingPaymentCompleted";

/** Canonical Phase 5.2 event set. */
export const BOOKING_SCHEDULE_DOMAIN_EVENTS = [
  "BookingCreated",
  "BookingScheduled",
  "BookingConfirmed",
  "BookingRescheduled",
  "BookingCancelled",
] as const;

export type BookingScheduleDomainEventType = (typeof BOOKING_SCHEDULE_DOMAIN_EVENTS)[number];

export type BookingDomainEventBase = {
  type: BookingDomainEventType;
  timestamp: string;
  traceId: string;
  requestId: string;
  bookingOperationId: string;
  bookingId?: number;
  customerId?: number;
  addressIdentityId?: number;
  addressSnapshotId?: number;
  coverageValidationId?: string;
  version: typeof BOOKING_DOMAIN_VERSION;
};

export type BookingCreatedEvent = BookingDomainEventBase & {
  type: "BookingCreated";
  bookingContext: BookingContext;
};

export type BookingScheduledEvent = BookingDomainEventBase & {
  type: "BookingScheduled";
  bookingContext: BookingContext;
};

export type BookingConfirmedEvent = BookingDomainEventBase & {
  type: "BookingConfirmed";
  bookingContext: BookingContext;
};

export type BookingRescheduledEvent = BookingDomainEventBase & {
  type: "BookingRescheduled";
  bookingContext: BookingContext;
  previousScheduledDate?: string;
  previousScheduledTime?: string | null;
  previousScheduledStartAt?: string | null;
  previousScheduledEndAt?: string | null;
};

export type BookingCancelledEvent = BookingDomainEventBase & {
  type: "BookingCancelled";
  bookingContext: BookingContext;
  reason?: string;
};

export type BookingValidatedEvent = BookingDomainEventBase & {
  type: "BookingValidated";
  bookingContext: BookingContext;
};

export type BookingAssignedEvent = BookingDomainEventBase & {
  type: "BookingAssigned";
  bookingContext: BookingContext;
  staffId: number;
};

export type BookingAcceptedEvent = BookingDomainEventBase & {
  type: "BookingAccepted";
  bookingContext: BookingContext;
};

export type BookingStartedEvent = BookingDomainEventBase & {
  type: "BookingStarted";
  bookingContext: BookingContext;
};

export type BookingPausedEvent = BookingDomainEventBase & {
  type: "BookingPaused";
  bookingContext: BookingContext;
  reason?: string;
};

export type BookingResumedEvent = BookingDomainEventBase & {
  type: "BookingResumed";
  bookingContext: BookingContext;
};

export type BookingCompletedEvent = BookingDomainEventBase & {
  type: "BookingCompleted";
  bookingContext: BookingContext;
};

export type BookingFailedEvent = BookingDomainEventBase & {
  type: "BookingFailed";
  bookingContext: BookingContext;
  reason?: string;
};

export type BookingReviewedEvent = BookingDomainEventBase & {
  type: "BookingReviewed";
  bookingContext: BookingContext;
  rating?: number;
};

export type BookingArchivedEvent = BookingDomainEventBase & {
  type: "BookingArchived";
  bookingContext: BookingContext;
};

export type BookingAddressChangedEvent = BookingDomainEventBase & {
  type: "BookingAddressChanged";
  bookingContext: BookingContext;
  previousAddressSnapshotId?: number;
};

export type BookingSnapshotCreatedEvent = BookingDomainEventBase & {
  type: "BookingSnapshotCreated";
  snapshotId: number;
  snapshotType: string;
};

export type BookingPaymentPendingEvent = BookingDomainEventBase & {
  type: "BookingPaymentPending";
  bookingContext: BookingContext;
  amount: string;
};

export type BookingPaymentCompletedEvent = BookingDomainEventBase & {
  type: "BookingPaymentCompleted";
  bookingContext: BookingContext;
  amount: string;
};

export type BookingDomainEvent =
  | BookingCreatedEvent
  | BookingScheduledEvent
  | BookingConfirmedEvent
  | BookingRescheduledEvent
  | BookingCancelledEvent
  | BookingValidatedEvent
  | BookingAssignedEvent
  | BookingAcceptedEvent
  | BookingStartedEvent
  | BookingPausedEvent
  | BookingResumedEvent
  | BookingCompletedEvent
  | BookingFailedEvent
  | BookingReviewedEvent
  | BookingArchivedEvent
  | BookingAddressChangedEvent
  | BookingSnapshotCreatedEvent
  | BookingPaymentPendingEvent
  | BookingPaymentCompletedEvent;

export function baseBookingEventFields(
  correlation: BookingTraceContext,
): Omit<BookingDomainEventBase, "type"> {
  return {
    timestamp: new Date().toISOString(),
    traceId: correlation.traceId,
    requestId: correlation.requestId,
    bookingOperationId: correlation.bookingOperationId,
    bookingId: correlation.bookingId,
    customerId: correlation.customerId,
    addressIdentityId: correlation.addressIdentityId,
    addressSnapshotId: correlation.addressSnapshotId,
    coverageValidationId: correlation.coverageValidationId,
    version: BOOKING_DOMAIN_VERSION,
  };
}

export const TIMELINE_EVENT_FOR_DOMAIN: Partial<Record<BookingDomainEventType, string>> = {
  BookingCreated: "BOOKING_CREATED",
  BookingScheduled: "BOOKING_VALIDATED",
  BookingConfirmed: "BOOKING_CONFIRMED",
  BookingRescheduled: "RESCHEDULED",
  BookingCancelled: "CANCELLED",
  BookingValidated: "BOOKING_VALIDATED",
  BookingAssigned: "ASSIGNED",
  BookingAccepted: "ACCEPTED",
  BookingStarted: "STARTED",
  BookingPaused: "PAUSED",
  BookingResumed: "RESUMED",
  BookingCompleted: "COMPLETED",
  BookingFailed: "FAILED",
  BookingReviewed: "REVIEWED",
  BookingArchived: "ARCHIVED",
  BookingAddressChanged: "ADDRESS_CHANGED",
  BookingSnapshotCreated: "ADDRESS_SNAPSHOT_CREATED",
  BookingPaymentPending: "PAYMENT_PENDING",
  BookingPaymentCompleted: "PAYMENT_COMPLETED",
};
