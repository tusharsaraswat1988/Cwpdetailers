import {
  COVERAGE_MESSAGES,
  toCoverageStatusLabel,
  toLegacyStatus,
  type CoverageStatusCode,
} from "../../coverage/CoverageTypes";
import type { PipelineState } from "../../coverage/validators/types";
import { calculateLocationConfidence } from "../confidence/ConfidenceScorer";
import { buildLocationContext, mapResolutionSource } from "../LocationContext";
import type { CoverageResultCore, ServiceAvailabilitySnapshot } from "./CoverageResultCore";
import { LOCATION_INTELLIGENCE_VERSION } from "../versioning";

export function buildLocationContextFromState(
  state: PipelineState,
  coverageStatus: ReturnType<typeof toCoverageStatusLabel>,
  confidenceScore: number,
): ReturnType<typeof buildLocationContext> {
  const city = state.city;
  return buildLocationContext({
    formattedAddress: state.request.address,
    placeId: state.request.placeId,
    parsed: state.parsedAddress,
    coordinates:
      state.request.locationLat != null && state.request.locationLng != null
        ? { latitude: state.request.locationLat, longitude: state.request.locationLng }
        : null,
    postalCode: state.pincode ?? state.parsedAddress.postalCode,
    serviceArea: state.pinRecord
      ? { id: state.pinRecord.serviceAreaId, name: state.pinRecord.serviceAreaName }
      : null,
    city: city
      ? { id: city.id, name: city.name, slug: city.slug, stateName: city.stateName }
      : null,
    stateName: city?.stateName ?? state.parsedAddress.state ?? undefined,
    country: state.parsedAddress.country ?? undefined,
    coverageStatus,
    confidenceScore,
    resolvedBy: mapResolutionSource(state.cityResolutionSource),
    validationId: state.correlation.coverageValidationId,
    metadata: {
      cityResolutionSource: state.cityResolutionSource,
      usedCityFallback: state.usedCityFallback,
      requestSource: state.requestSource,
      traceId: state.correlation.traceId,
    },
  });
}

function buildServiceAvailability(state: PipelineState, success: boolean): ServiceAvailabilitySnapshot | undefined {
  if (!success) return undefined;
  return {
    serviceId: state.request.serviceId ?? undefined,
    available: true,
    cityId: state.city?.id,
  };
}

export function buildCoverageResultCore(
  state: PipelineState,
  success: boolean,
  status: CoverageStatusCode,
  message?: string,
): CoverageResultCore {
  const msg =
    message ??
    (success
      ? "Service address is serviceable."
      : COVERAGE_MESSAGES[status as keyof typeof COVERAGE_MESSAGES] ?? "Coverage validation failed.");
  const coverageStatus = toCoverageStatusLabel(status, success);
  const confidenceScore = calculateLocationConfidence(state);
  const locationContext = buildLocationContextFromState(state, coverageStatus, confidenceScore);

  return {
    success,
    status,
    legacyStatus: toLegacyStatus(status),
    message: msg,
    coverageStatus,
    correlation: state.correlation,
    locationContext,
    serviceAvailability: buildServiceAvailability(state, success),
    confidenceScore,
    resolvedCityId: state.city?.id,
    version: LOCATION_INTELLIGENCE_VERSION,
  };
}

export function buildCoverageEngineOutput(
  state: PipelineState,
  success: boolean,
  status: CoverageStatusCode,
  message?: string,
) {
  const core = buildCoverageResultCore(state, success, status, message);
  return {
    core,
    _catalog: state.serviceCatalog
      ? {
          availableServices: state.serviceCatalog.availableServices,
          comingSoonServices: state.serviceCatalog.comingSoonServices,
          unavailableServices: state.serviceCatalog.unavailableServices,
        }
      : undefined,
  };
}
