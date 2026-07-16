import type { LocationContext } from "../../LocationContext";
import type { TraceContext } from "../../correlation/TraceContext";
import type { CoverageStatusCode } from "../../../coverage/CoverageTypes";

export type LocationDomainEventType =
  | "LocationResolved"
  | "CoverageValidated"
  | "CoverageRejected"
  | "CoverageCacheHit"
  | "CoverageCacheMiss"
  | "CoverageDemandDetected"
  | "BookingCoverageValidated"
  | "BookingCoverageRejected";

export type LocationDomainEventBase = {
  type: LocationDomainEventType;
  timestamp: string;
  traceId: string;
  requestId: string;
  coverageValidationId: string;
  bookingId?: number;
  version: "LocationIntelligenceV1";
};

export type LocationResolvedEvent = LocationDomainEventBase & {
  type: "LocationResolved";
  locationContext: LocationContext;
};

export type CoverageValidatedEvent = LocationDomainEventBase & {
  type: "CoverageValidated";
  locationContext: LocationContext;
  confidenceScore: number;
};

export type CoverageRejectedEvent = LocationDomainEventBase & {
  type: "CoverageRejected";
  status: CoverageStatusCode;
  reason: string;
  locationContext?: LocationContext;
};

export type CoverageCacheEvent = LocationDomainEventBase & {
  type: "CoverageCacheHit" | "CoverageCacheMiss";
  cacheKey: string;
  namespace: string;
};

export type CoverageDemandDetectedEvent = LocationDomainEventBase & {
  type: "CoverageDemandDetected";
  pincode?: string;
  cityId?: number;
  serviceId?: number | null;
  reason: string;
};

export type BookingCoverageEvent = LocationDomainEventBase & {
  type: "BookingCoverageValidated" | "BookingCoverageRejected";
  customerId?: number;
  serviceId?: number | null;
  status?: CoverageStatusCode;
};

export type LocationDomainEvent =
  | LocationResolvedEvent
  | CoverageValidatedEvent
  | CoverageRejectedEvent
  | CoverageCacheEvent
  | CoverageDemandDetectedEvent
  | BookingCoverageEvent;

export function baseEventFields(correlation: TraceContext, bookingId?: number): Omit<LocationDomainEventBase, "type"> {
  return {
    timestamp: new Date().toISOString(),
    traceId: correlation.traceId,
    requestId: correlation.requestId,
    coverageValidationId: correlation.coverageValidationId,
    bookingId: bookingId ?? correlation.bookingId,
    version: "LocationIntelligenceV1",
  };
}
