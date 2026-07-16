import { randomUUID } from "node:crypto";

export type BookingTraceContext = {
  traceId: string;
  requestId: string;
  bookingOperationId: string;
  bookingId?: number;
  customerId?: number;
  addressIdentityId?: number;
  addressSnapshotId?: number;
  coverageValidationId?: string;
};

export function createBookingOperationId(): string {
  return randomUUID();
}

export function buildBookingTraceContext(opts?: {
  traceId?: string;
  requestId?: string;
  bookingId?: number;
  customerId?: number;
  addressIdentityId?: number;
  addressSnapshotId?: number;
  coverageValidationId?: string;
}): BookingTraceContext {
  const traceId = opts?.traceId ?? randomUUID();
  return {
    traceId,
    requestId: opts?.requestId ?? traceId,
    bookingOperationId: createBookingOperationId(),
    bookingId: opts?.bookingId,
    customerId: opts?.customerId,
    addressIdentityId: opts?.addressIdentityId,
    addressSnapshotId: opts?.addressSnapshotId,
    coverageValidationId: opts?.coverageValidationId,
  };
}

export function resolveBookingTraceId(headerValue?: string | string[] | null): string {
  if (typeof headerValue === "string" && headerValue.trim()) return headerValue.trim();
  if (Array.isArray(headerValue) && headerValue[0]?.trim()) return headerValue[0].trim();
  return randomUUID();
}
