/**
 * Coverage Engine — single source of truth for location-based decisions.
 *
 * Serviceability (booking gate) is one capability of this module.
 */

export type {
  CoverageRequest,
  CoverageResult,
  CoverageStatusCode,
  CoverageStatusLabel,
  CoverageCheckOptions,
  CoverageCorrelation,
  ServiceabilityRequest,
  ServiceabilityResult,
  ServiceabilityStatus,
  GoogleAddressComponent,
  ParsedAddressComponents,
  CitySummary,
  ServiceSummary,
} from "./CoverageTypes";

export {
  COVERAGE_MESSAGES,
  SERVICEABILITY_MESSAGES,
  toLegacyStatus,
  toCoverageStatusLabel,
} from "./CoverageTypes";

export {
  buildCoverageRequest,
  buildServiceabilityRequest,
  parseGoogleAddressComponents,
  extractPincodeFromText,
  compositeAddressParser,
  googleAddressParser,
  manualAddressParser,
} from "./parsers";

export type { AddressParser } from "./parsers/AddressParser";

export {
  CoverageValidationError,
  ServiceabilityValidationError,
  assertCoverageSuccess,
  assertServiceabilitySuccess,
} from "./CoverageErrors";

export {
  coverageEngine,
  CoverageEngine,
  validateServiceability,
  validateServiceabilityForBooking,
  toCoverageCheckResponse,
  serviceabilityHttpBody,
  SERVICEABILITY_HTTP_STATUS,
} from "./CoverageEngine";

export {
  coverageCache,
  invalidateCoverageCacheForMasterUpdate,
  resetCoverageCacheForTests,
  COVERAGE_CACHE_DEFAULT_TTL_MS,
} from "./CoverageCache";

export {
  coverageRepository,
  cityRepository,
  pinRepository,
  serviceAvailabilityRepository,
} from "./repositories/CoverageRepository";

export {
  coverageValidators,
  CoverageValidators,
} from "./CoverageValidators";

export {
  buildCoverageMetricsPayload,
  buildDemandSignalPayload,
  emitCoverageMetrics,
  emitDemandSignal,
  serviceabilityBlockedLogPayload,
} from "./CoverageMetrics";

export { createCoverageValidationId, resolveRequestId, buildCorrelation } from "./CoverageCorrelation";

export {
  locationIntelligencePlatform,
  LocationIntelligencePlatform,
} from "../location-intelligence/LocationIntelligencePlatform";
export { buildLocationContext } from "../location-intelligence/LocationContext";
export { calculateLocationConfidence } from "../location-intelligence/confidence/ConfidenceScorer";
export { locationDomainEventPublisher } from "../location-intelligence/domain/events/EventPublisher";
export { LOCATION_INTELLIGENCE_VERSION } from "../location-intelligence/versioning";
