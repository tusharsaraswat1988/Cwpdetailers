import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: { select: vi.fn() },
  pincodesTable: {},
  serviceAreasTable: {},
  citiesTable: {},
  statesTable: {},
  servicesTable: {},
  serviceCityAvailabilityTable: {},
}));

import { calculateLocationConfidence } from "./confidence/ConfidenceScorer";
import { buildLocationContext, mapResolutionSource } from "./LocationContext";
import { buildCoverageResultCore } from "./domain/CoverageResultBuilder";
import { locationDomainEventPublisher } from "./domain/events/EventPublisher";
import { coveragePolicy, CoveragePolicy } from "./policies/CoveragePolicy";
import { bookingPolicy } from "./policies/BookingPolicy";
import { buildTraceContext } from "./correlation/TraceContext";
import type { PipelineState } from "../coverage/validators/types";
import { cityRecordToEntity, pinRecordToEntity } from "./domain/entityMappers";

function baseState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    request: {
      address: "Test Address",
      locationLat: 25.28,
      locationLng: 82.99,
      serviceId: 10,
    },
    parsedAddress: { postalCode: "221005", city: "Varanasi" },
    pincode: "221005",
    city: { id: 7, name: "Varanasi", slug: "varanasi", isActive: true, stateName: "Uttar Pradesh" },
    cityResolutionSource: "pin",
    correlation: buildTraceContext({ requestId: "req-1" }),
    requestSource: "test",
    ...overrides,
  };
}

describe("Location Intelligence — ConfidenceScorer", () => {
  it("scores 100 for GPS + Google + PIN master", () => {
    const state = baseState({
      request: {
        address: "Test",
        locationLat: 25.28,
        locationLng: 82.99,
        addressComponents: [{ long_name: "221005", short_name: "221005", types: ["postal_code"] }],
      },
      pinRecord: {
        pincode: "221005",
        pincodeId: 1,
        pincodeActive: true,
        serviceAreaId: 5,
        serviceAreaName: "Lanka",
        serviceAreaActive: true,
        cityId: 7,
        cityName: "Varanasi",
        citySlug: "varanasi",
        cityActive: true,
        stateName: "UP",
        stateCode: "UP",
      },
    });
    expect(calculateLocationConfidence(state)).toBe(100);
  });

  it("scores 95 for Google address components", () => {
    const state = baseState({
      pincode: undefined,
      pinRecord: undefined,
      parsedAddress: { city: "Mumbai" },
      cityResolutionSource: "google_city",
      request: {
        address: "Mumbai",
        locationLat: 19.0,
        locationLng: 72.8,
        addressComponents: [{ long_name: "Mumbai", short_name: "Mumbai", types: ["locality"] }],
      },
    });
    expect(calculateLocationConfidence(state)).toBe(95);
  });

  it("scores 25 for legacy citySlug resolution", () => {
    const state = baseState({
      pincode: undefined,
      pinRecord: undefined,
      parsedAddress: {},
      cityResolutionSource: "city_slug",
      request: { address: "Test", locationLat: 25, locationLng: 82, citySlug: "varanasi" },
    });
    expect(calculateLocationConfidence(state)).toBe(25);
  });

  it("scores 0 when resolution is unknown", () => {
    const state = baseState({
      pincode: undefined,
      pinRecord: undefined,
      parsedAddress: {},
      city: undefined,
      cityResolutionSource: undefined,
      request: { address: "Test", locationLat: null, locationLng: null },
    });
    expect(calculateLocationConfidence(state)).toBe(0);
  });
});

describe("Location Intelligence — LocationContext", () => {
  it("builds context with validation id and confidence", () => {
    const ctx = buildLocationContext({
      parsed: { city: "Varanasi", postalCode: "221005" },
      coverageStatus: "AVAILABLE",
      confidenceScore: 100,
      resolvedBy: "pin_master",
      validationId: "val-123",
    });
    expect(ctx.validationId).toBe("val-123");
    expect(ctx.confidenceScore).toBe(100);
    expect(ctx.metadata.version).toBe("LocationIntelligenceV1");
  });

  it("maps resolution sources", () => {
    expect(mapResolutionSource("pin")).toBe("pin_master");
    expect(mapResolutionSource("city_slug")).toBe("city_slug");
    expect(mapResolutionSource(undefined)).toBe("unknown");
  });
});

describe("Location Intelligence — CoverageResultCore", () => {
  it("builds core result without catalog lists", () => {
    const core = buildCoverageResultCore(baseState(), true, "SUCCESS");
    expect(core.success).toBe(true);
    expect(core.locationContext.confidenceScore).toBeGreaterThan(0);
    expect(core.version).toBe("LocationIntelligenceV1");
    expect(core.correlation.traceId).toBeTruthy();
  });
});

describe("Location Intelligence — Domain Events", () => {
  beforeEach(() => {
    locationDomainEventPublisher.clearSubscribers();
  });

  it("publishes events to subscribers", () => {
    const received: string[] = [];
    locationDomainEventPublisher.subscribe(evt => received.push(evt.type));

    const correlation = buildTraceContext({ requestId: "req-evt" });
    locationDomainEventPublisher.publish({
      type: "CoverageValidated",
      timestamp: new Date().toISOString(),
      traceId: correlation.traceId,
      requestId: correlation.requestId,
      coverageValidationId: correlation.coverageValidationId,
      version: "LocationIntelligenceV1",
      locationContext: buildLocationContext({
        parsed: {},
        coverageStatus: "AVAILABLE",
        confidenceScore: 90,
        resolvedBy: "pin_master",
        validationId: correlation.coverageValidationId,
      }),
      confidenceScore: 90,
    });

    expect(received).toContain("CoverageValidated");
  });
});

describe("Location Intelligence — Policies", () => {
  it("CoveragePolicy wraps validators", () => {
    expect(coveragePolicy).toBeInstanceOf(CoveragePolicy);
    expect(bookingPolicy).toBeTruthy();
  });
});

describe("Location Intelligence — Repository entities", () => {
  it("maps city record to domain entity", () => {
    const entity = cityRecordToEntity({
      id: 1,
      name: "Varanasi",
      slug: "varanasi",
      isActive: true,
      stateName: "Uttar Pradesh",
    });
    expect(entity.state.name).toBe("Uttar Pradesh");
    expect(entity.id).toBe(1);
  });

  it("maps pin record to PinResolutionEntity", () => {
    const entity = pinRecordToEntity({
      pincode: "221005",
      pincodeId: 1,
      pincodeActive: true,
      serviceAreaId: 5,
      serviceAreaName: "Lanka",
      serviceAreaActive: true,
      cityId: 7,
      cityName: "Varanasi",
      citySlug: "varanasi",
      cityActive: true,
      stateName: "Uttar Pradesh",
      stateCode: "UP",
    });
    expect(entity.serviceArea.name).toBe("Lanka");
    expect(entity.city.slug).toBe("varanasi");
  });
});

describe("Location Intelligence — TraceContext", () => {
  it("includes traceId in correlation", () => {
    const ctx = buildTraceContext({ requestId: "req-trace", bookingId: 42 });
    expect(ctx.traceId).toBeTruthy();
    expect(ctx.requestId).toBe("req-trace");
    expect(ctx.bookingId).toBe(42);
  });
});
