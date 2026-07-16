import type { Logger } from "pino";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";

export type BookingMetricsPayload = {
  event: string;
  timestamp: string;
  traceId: string;
  requestId: string;
  bookingOperationId: string;
  bookingId?: number;
  customerId?: number;
  addressIdentityId?: number;
  addressSnapshotId?: number;
  coverageValidationId?: string;
  operation: string;
  success: boolean;
  durationMs?: number;
  platformStatus?: string;
  legacyStatus?: string;
  coverageFailure?: boolean;
  businessRuleFailure?: boolean;
  failureReason?: string;
};

export function buildBookingMetrics(
  operation: string,
  trace: BookingTraceContext,
  opts: {
    success: boolean;
    durationMs?: number;
    platformStatus?: string;
    legacyStatus?: string;
    coverageFailure?: boolean;
    businessRuleFailure?: boolean;
    failureReason?: string;
  },
): BookingMetricsPayload {
  return {
    event: `booking_${operation}`,
    timestamp: new Date().toISOString(),
    traceId: trace.traceId,
    requestId: trace.requestId,
    bookingOperationId: trace.bookingOperationId,
    bookingId: trace.bookingId,
    customerId: trace.customerId,
    addressIdentityId: trace.addressIdentityId,
    addressSnapshotId: trace.addressSnapshotId,
    coverageValidationId: trace.coverageValidationId,
    operation,
    success: opts.success,
    durationMs: opts.durationMs,
    platformStatus: opts.platformStatus,
    legacyStatus: opts.legacyStatus,
    coverageFailure: opts.coverageFailure,
    businessRuleFailure: opts.businessRuleFailure,
    failureReason: opts.failureReason,
  };
}

export function emitBookingMetrics(logger: Logger | undefined, payload: BookingMetricsPayload): void {
  logger?.info(payload, `booking operation: ${payload.operation}`);
}
