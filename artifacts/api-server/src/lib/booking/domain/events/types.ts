import type { BookingTraceContext } from "../../correlation/BookingTraceContext";
import { BOOKING_DOMAIN_VERSION } from "../../versioning";
import type { BookingContext } from "../../BookingContext";

export type BookingDomainEventType =
  | "BookingCreated"
  | "BookingValidated"
  | "BookingConfirmed"
  | "BookingAssigned"
  | "BookingAccepted"
  | "BookingStarted"
  | "BookingPaused"
  | "BookingResumed"
  | "BookingCompleted"
  | "BookingCancelled"
  | "BookingFailed"
  | "BookingReviewed"
  | "BookingArchived"
  | "BookingAddressChanged"
  | "BookingSnapshotCreated"
  | "BookingPaymentPending"
  | "BookingPaymentCompleted";

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

export type BookingValidatedEvent = BookingDomainEventBase & {
  type: "BookingValidated";
  bookingContext: BookingContext;
};

export type BookingConfirmedEvent = BookingDomainEventBase & {
  type: "BookingConfirmed";
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

export type BookingCancelledEvent = BookingDomainEventBase & {
  type: "BookingCancelled";
  bookingContext: BookingContext;
  reason?: string;
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
  | BookingValidatedEvent
  | BookingConfirmedEvent
  | BookingAssignedEvent
  | BookingAcceptedEvent
  | BookingStartedEvent
  | BookingPausedEvent
  | BookingResumedEvent
  | BookingCompletedEvent
  | BookingCancelledEvent
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
  BookingValidated: "BOOKING_VALIDATED",
  BookingConfirmed: "BOOKING_CONFIRMED",
  BookingAssigned: "ASSIGNED",
  BookingAccepted: "ACCEPTED",
  BookingStarted: "STARTED",
  BookingPaused: "PAUSED",
  BookingResumed: "RESUMED",
  BookingCompleted: "COMPLETED",
  BookingCancelled: "CANCELLED",
  BookingFailed: "FAILED",
  BookingReviewed: "REVIEWED",
  BookingArchived: "ARCHIVED",
  BookingAddressChanged: "ADDRESS_CHANGED",
  BookingSnapshotCreated: "ADDRESS_SNAPSHOT_CREATED",
  BookingPaymentPending: "PAYMENT_PENDING",
  BookingPaymentCompleted: "PAYMENT_COMPLETED",
};
