/**
 * Location Intelligence Platform — public API.
 *
 * Coverage Engine is one module inside this platform.
 * Legacy `lib/coverage` and `lib/serviceability` imports remain supported.
 */

export { LOCATION_INTELLIGENCE_VERSION, COVERAGE_STRATEGY_VERSION } from "./versioning";
export type { LocationIntelligenceVersion, CoverageStrategyVersion } from "./versioning";

export type {
  LocationContext,
  LocationCoordinates,
  LocationServiceArea,
  LocationState,
  LocationResolvedBy,
  BuildLocationContextInput,
} from "./LocationContext";
export { buildLocationContext, mapResolutionSource } from "./LocationContext";

export type { TraceContext } from "./correlation/TraceContext";
export {
  buildTraceContext,
  createTraceId,
  resolveTraceId,
  buildCorrelation,
  createCoverageValidationId,
  resolveRequestId,
} from "./correlation/TraceContext";

export type { CoverageResultCore, CoverageEngineOutput, ServiceAvailabilitySnapshot } from "./domain/CoverageResultCore";
export { buildCoverageResultCore, buildCoverageEngineOutput, buildLocationContextFromState } from "./domain/CoverageResultBuilder";

export type { CityEntity, StateEntity, ServiceAreaEntity, PinResolutionEntity } from "./domain/entities";
export { toCitySummary } from "./domain/entities";

export type { GeographyLevel, GeographyNode, GeographyHierarchy } from "./domain/geography/Hierarchy";
export { buildGeographyHierarchyFromMaster } from "./domain/geography/Hierarchy";

export type { LocationDomainEvent, LocationDomainEventType } from "./domain/events/types";
export { locationDomainEventPublisher, LocationDomainEventPublisher } from "./domain/events/EventPublisher";

export type { LocationPolicy, PolicyContext } from "./policies/types";
export {
  CoveragePolicy,
  coveragePolicy,
  coveragePolicies,
  addressPolicy,
  pinPolicy,
  serviceAreaPolicy,
  cityPolicy,
  servicePolicy,
} from "./policies/CoveragePolicy";
export {
  BookingPolicy,
  bookingPolicy,
  pricingPolicy,
  expansionPolicy,
  workforcePolicy,
} from "./policies/BookingPolicy";

export { calculateLocationConfidence } from "./confidence/ConfidenceScorer";

export { ServiceCatalogTransformer, serviceCatalogTransformer } from "./catalog/ServiceCatalogTransformer";
export type { ServiceCatalogView } from "./catalog/ServiceCatalogTransformer";

export type {
  BranchResolver,
  FranchiseResolver,
  WorkforceResolver,
  EtaResolver,
  PricingResolver,
  HolidayResolver,
  OperatingHoursResolver,
  InventoryResolver,
  RecommendationResolver,
  LocationExtensionRegistry,
} from "./extensions/interfaces";
export { locationExtensionRegistry } from "./extensions/interfaces";

export {
  LocationIntelligencePlatform,
  locationIntelligencePlatform,
} from "./LocationIntelligencePlatform";
export type { LocationIntelligenceOptions } from "./LocationIntelligencePlatform";

export {
  buildLocationMetrics,
  emitLocationMetrics,
  coreToLegacyResult,
} from "./metrics/LocationMetrics";
export type { LocationMetricsBundle } from "./metrics/LocationMetrics";
