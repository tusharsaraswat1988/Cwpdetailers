import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  bookingsTable: {},
  bookingTimelineTable: {},
  bookingSnapshotsTable: {},
  addressesTable: {},
  addressIdentitiesTable: {},
}));

import { buildBookingContext } from "./BookingContext";
import { buildBookingTraceContext } from "./correlation/BookingTraceContext";
import { bookingDomainEventPublisher } from "./domain/events/EventPublisher";
import { BOOKING_DOMAIN_VERSION, BOOKING_CAPABILITY_VERSION } from "./versioning";
import {
  validatePlatformTransition,
  validateLegacyTransition,
  canTransitionPlatform,
  canTransitionLegacy,
  resolvePlatformStatus,
  resolveLegacyStatus,
  mapLegacyTransitionToPlatform,
  LEGACY_TO_PLATFORM,
  PLATFORM_TO_LEGACY,
  BookingStateMachineError,
} from "./domain/stateMachine";
import { businessRulesEngine } from "./businessRules/BusinessRulesEngine";
import { defaultBookingRules, workingHoursRule, coverageAvailabilityRule } from "./businessRules/rules";
import { bookingCapability } from "./capability/BookingCapability";
import { flattenCoverageServices, isServiceAvailableInCoverage } from "./services/coverageServiceMapper";
import type { CoverageResult } from "../coverage/CoverageTypes";

describe("Booking Platform Versioning", () => {
  it("exports frozen version markers", () => {
    expect(BOOKING_DOMAIN_VERSION).toBe("BookingDomainV1");
    expect(BOOKING_CAPABILITY_VERSION).toBe("BookingCapabilityV1");
    expect(bookingCapability.version).toBe(BOOKING_CAPABILITY_VERSION);
  });
});

describe("BookingTraceContext", () => {
  it("builds correlation with operation id", () => {
    const trace = buildBookingTraceContext({ requestId: "req-1", customerId: 5, bookingId: 10 });
    expect(trace.requestId).toBe("req-1");
    expect(trace.customerId).toBe(5);
    expect(trace.bookingId).toBe(10);
    expect(trace.bookingOperationId).toBeTruthy();
    expect(trace.traceId).toBeTruthy();
  });
});

describe("BookingContext", () => {
  it("builds context with correlation and version", () => {
    const trace = buildBookingTraceContext({ customerId: 1, bookingId: 99 });
    const ctx = buildBookingContext({
      booking: {
        id: 99,
        customerId: 1,
        serviceType: "car_wash",
        scheduledDate: "2026-07-16",
        status: "scheduled",
        platformStatus: "CONFIRMED",
      },
      correlation: trace,
    });
    expect(ctx.metadata.version).toBe(BOOKING_DOMAIN_VERSION);
    expect(ctx.state.platformStatus).toBe("CONFIRMED");
    expect(ctx.state.legacyStatus).toBe("scheduled");
    expect(ctx.correlation.bookingOperationId).toBe(trace.bookingOperationId);
  });
});

describe("Booking State Machine", () => {
  it("allows valid platform transitions", () => {
    expect(canTransitionPlatform("DRAFT", "VALIDATED")).toBe(true);
    expect(canTransitionPlatform("STARTED", "COMPLETED")).toBe(true);
    expect(canTransitionPlatform("COMPLETED", "ARCHIVED")).toBe(true);
    expect(canTransitionPlatform("COMPLETED", "REVIEW_PENDING")).toBe(true);
  });

  it("rejects invalid platform transitions", () => {
    expect(() => validatePlatformTransition("DRAFT", "COMPLETED")).toThrow(BookingStateMachineError);
  });

  it("preserves legacy transitions", () => {
    expect(canTransitionLegacy("scheduled", "confirmed")).toBe(true);
    expect(canTransitionLegacy("confirmed", "en_route")).toBe(true);
    expect(() => validateLegacyTransition("completed", "confirmed")).toThrow(BookingStateMachineError);
  });

  it("maps legacy to platform status", () => {
    expect(LEGACY_TO_PLATFORM.pending).toBe("DRAFT");
    expect(LEGACY_TO_PLATFORM.en_route).toBe("TRAVELLING");
    expect(LEGACY_TO_PLATFORM.in_progress).toBe("STARTED");
    expect(PLATFORM_TO_LEGACY.TRAVELLING).toBe("en_route");
  });

  it("resolves platform status from legacy", () => {
    expect(resolvePlatformStatus("en_route")).toBe("TRAVELLING");
    expect(resolveLegacyStatus("TRAVELLING")).toBe("en_route");
    expect(mapLegacyTransitionToPlatform("in_progress")).toBe("STARTED");
  });
});

describe("Business Rules Engine", () => {
  beforeEach(() => {
    businessRulesEngine.clear();
    businessRulesEngine.registerAll(defaultBookingRules);
  });

  it("passes working hours rule for valid time", async () => {
    const result = await workingHoursRule.evaluate({
      scheduledDate: "2026-07-16",
      scheduledTime: "10:00",
      trace: buildBookingTraceContext(),
    });
    expect(result.passed).toBe(true);
  });

  it("fails working hours rule for early morning", async () => {
    const result = await workingHoursRule.evaluate({
      scheduledDate: "2026-07-16",
      scheduledTime: "04:00",
      trace: buildBookingTraceContext(),
    });
    expect(result.passed).toBe(false);
  });

  it("evaluates all default rules", async () => {
    const evaluation = await businessRulesEngine.evaluate({
      customerId: 1,
      serviceType: "car_wash",
      scheduledDate: "2026-07-16",
      scheduledTime: "10:00",
      amount: "500",
      coverageStatus: "AVAILABLE",
      trace: buildBookingTraceContext(),
    });
    expect(evaluation.passed).toBe(true);
    expect(evaluation.results.length).toBeGreaterThan(0);
  });

  it("blocks unavailable coverage", async () => {
    const result = await coverageAvailabilityRule.evaluate({
      coverageStatus: "UNAVAILABLE",
      trace: buildBookingTraceContext(),
    });
    expect(result.passed).toBe(false);
  });
});

describe("Coverage Service Mapper", () => {
  it("flattens coverage service lists", () => {
    const coverage = {
      success: true,
      availableServices: [{ id: 1, name: "Daily Cleaning", slug: "daily" }],
      comingSoonServices: [{ id: 2, name: "PPF", slug: "ppf" }],
      unavailableServices: [{ id: 3, name: "Bike Wash", slug: "bike" }],
    } as CoverageResult;
    const services = flattenCoverageServices(coverage);
    expect(services).toHaveLength(3);
    expect(services[0].availability).toBe("AVAILABLE");
    expect(services[1].availability).toBe("COMING_SOON");
    expect(services[2].availability).toBe("UNAVAILABLE");
  });

  it("allows booking when catalog not loaded", () => {
    const coverage = { success: true } as CoverageResult;
    expect(isServiceAvailableInCoverage(coverage, 1)).toBe(true);
  });
});

describe("Booking Domain Events", () => {
  beforeEach(() => bookingDomainEventPublisher.clearSubscribers());

  it("publishes events to subscribers", () => {
    const received: string[] = [];
    bookingDomainEventPublisher.subscribe((e) => { received.push(e.type); });
    const trace = buildBookingTraceContext({ bookingId: 1 });
    bookingDomainEventPublisher.publish({
      type: "BookingCreated",
      ...{
        timestamp: new Date().toISOString(),
        traceId: trace.traceId,
        requestId: trace.requestId,
        bookingOperationId: trace.bookingOperationId,
        version: BOOKING_DOMAIN_VERSION,
      },
      bookingContext: buildBookingContext({
        booking: { id: 1, customerId: 1, serviceType: "car_wash", scheduledDate: "2026-07-16", status: "pending", platformStatus: "DRAFT" },
        correlation: trace,
      }),
    });
    expect(received).toEqual(["BookingCreated"]);
  });
});

describe("Backward Compatibility", () => {
  it("maps all legacy statuses to platform statuses", () => {
    const legacyStatuses = ["pending", "scheduled", "confirmed", "en_route", "in_progress", "completed", "cancelled", "rescheduled", "missed"];
    for (const status of legacyStatuses) {
      expect(LEGACY_TO_PLATFORM[status]).toBeTruthy();
      expect(resolvePlatformStatus(status)).toBeTruthy();
    }
  });
});
