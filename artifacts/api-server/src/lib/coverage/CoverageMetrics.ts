import type { Logger } from "pino";
import type { CoverageResult } from "./CoverageTypes";
import type { PipelineState } from "./validators/types";

export type CoverageMetricsPayload = {
  event: "coverage_validation";
  timestamp: string;
  coverageValidationId: string;
  requestId: string;
  traceId?: string;
  bookingId?: number;
  customerId?: number;
  serviceId?: number | null;
  cityId?: number;
  cityName?: string;
  postalCode?: string;
  serviceArea?: string;
  serviceAreaId?: number;
  coverageStatus: string;
  statusCode: string;
  failureReason?: string;
  requestSource: string;
  cityResolutionSource?: string;
  usedCityFallback?: boolean;
  success: boolean;
  confidenceScore?: number;
  cacheHits?: number;
  cacheMisses?: number;
  durationMs?: number;
};

export type CoverageDemandSignalPayload = {
  event: "coverage_demand_signal";
  timestamp: string;
  coverageValidationId: string;
  requestId: string;
  customerId?: number;
  serviceId?: number | null;
  pincode?: string;
  cityId?: number;
  cityName?: string;
  requestedService?: number | null;
  reason: string;
  statusCode: string;
  requestSource: string;
};

export function buildCoverageMetricsPayload(
  result: CoverageResult,
  state: PipelineState,
): CoverageMetricsPayload {
  return {
    event: "coverage_validation",
    timestamp: new Date().toISOString(),
    coverageValidationId: result.correlation.coverageValidationId,
    requestId: result.correlation.requestId,
    traceId: result.correlation.traceId,
    bookingId: result.correlation.bookingId,
    customerId: state.request.customerId,
    serviceId: state.request.serviceId ?? result.serviceId ?? null,
    cityId: result.cityId ?? state.city?.id,
    cityName: result.cityName ?? state.city?.name,
    postalCode: result.pincode ?? state.parsedAddress.postalCode ?? undefined,
    serviceArea: result.serviceArea ?? result.serviceAreaName,
    serviceAreaId: result.serviceAreaId,
    coverageStatus: result.coverageStatus,
    statusCode: result.status,
    failureReason: result.success ? undefined : result.message,
    requestSource: state.requestSource,
    cityResolutionSource: result.cityResolutionSource ?? state.cityResolutionSource,
    usedCityFallback: result.usedCityFallback,
    success: result.success,
    confidenceScore: result.confidenceScore ?? result.locationContext?.confidenceScore,
  };
}

export function buildDemandSignalPayload(
  result: CoverageResult,
  state: PipelineState,
): CoverageDemandSignalPayload {
  return {
    event: "coverage_demand_signal",
    timestamp: new Date().toISOString(),
    coverageValidationId: result.correlation.coverageValidationId,
    requestId: result.correlation.requestId,
    customerId: state.request.customerId,
    serviceId: state.request.serviceId ?? null,
    pincode: result.pincode ?? state.parsedAddress.postalCode ?? undefined,
    cityId: result.cityId ?? state.city?.id,
    cityName: result.cityName ?? state.city?.name,
    requestedService: state.request.serviceId ?? null,
    reason: result.status,
    statusCode: result.status,
    requestSource: state.requestSource,
  };
}

export function emitCoverageMetrics(logger: Logger | undefined, payload: CoverageMetricsPayload): void {
  logger?.info(payload, "coverage validation completed");
}

export function emitDemandSignal(logger: Logger | undefined, payload: CoverageDemandSignalPayload): void {
  logger?.warn(payload, "coverage demand signal — booking blocked");
}

export type ServiceabilityLogContext = {
  customerId?: number;
  bookingId?: number;
  serviceId?: number | null;
};

/** @deprecated Phase 1 alias */
export function serviceabilityBlockedLogPayload(
  result: CoverageResult,
  ctx: ServiceabilityLogContext = {},
) {
  return {
    event: "booking_serviceability_blocked",
    customerId: ctx.customerId,
    bookingId: ctx.bookingId,
    serviceId: ctx.serviceId ?? result.serviceId,
    pincode: result.pincode ?? result.parsedAddress?.postalCode,
    cityId: result.cityId,
    cityName: result.cityName,
    serviceAreaId: result.serviceAreaId,
    status: result.legacyStatus,
    coverageValidationId: result.correlation.coverageValidationId,
    requestId: result.correlation.requestId,
    usedCityFallback: result.usedCityFallback ?? false,
  };
}
