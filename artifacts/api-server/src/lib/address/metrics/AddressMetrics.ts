import type { Logger } from "pino";
import type { AddressTraceContext } from "../correlation/AddressTraceContext";

export type AddressMetricsPayload = {
  event: string;
  timestamp: string;
  traceId: string;
  requestId: string;
  addressOperationId: string;
  identityId?: number;
  addressId?: number;
  customerId?: number;
  operation: string;
  success: boolean;
  durationMs?: number;
  addressConfidenceScore?: number;
  locationConfidenceScore?: number | null;
  duplicateCount?: number;
  failureReason?: string;
};

export function buildAddressMetrics(
  operation: string,
  trace: AddressTraceContext,
  opts: {
    success: boolean;
    durationMs?: number;
    addressConfidenceScore?: number;
    locationConfidenceScore?: number | null;
    duplicateCount?: number;
    failureReason?: string;
  },
): AddressMetricsPayload {
  return {
    event: `address_${operation}`,
    timestamp: new Date().toISOString(),
    traceId: trace.traceId,
    requestId: trace.requestId,
    addressOperationId: trace.addressOperationId,
    identityId: trace.identityId,
    addressId: trace.addressId,
    customerId: trace.customerId,
    operation,
    success: opts.success,
    durationMs: opts.durationMs,
    addressConfidenceScore: opts.addressConfidenceScore,
    locationConfidenceScore: opts.locationConfidenceScore,
    duplicateCount: opts.duplicateCount,
    failureReason: opts.failureReason,
  };
}

export function emitAddressMetrics(logger: Logger | undefined, payload: AddressMetricsPayload): void {
  logger?.info(payload, `address operation: ${payload.operation}`);
}
