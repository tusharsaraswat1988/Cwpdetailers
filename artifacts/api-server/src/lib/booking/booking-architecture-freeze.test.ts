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
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  SLOT_OCCUPYING_STATUSES,
  validateTransition,
  canTransition,
  isTerminalStatus,
  isActiveScheduleStatus,
  BookingStateMachineError,
} from "./domain/stateMachine";
import { businessRulesEngine } from "./businessRules/BusinessRulesEngine";
import { defaultBookingRules, workingHoursRule, coverageAvailabilityRule } from "./businessRules/rules";
import { bookingCapability } from "./capability/BookingCapability";
import { flattenCoverageServices, isServiceAvailableInCoverage } from "./services/coverageServiceMapper";
import type { CoverageResult } from "../coverage/CoverageTypes";

describe("Booking Platform Versioning", () => {
  it("exports frozen version markers", () => {
    expect(BOOKING_DOMAIN_VERSION).toBe("BookingDomainV2");
    expect(BOOKING_CAPABILITY_VERSION).toBe("BookingCapabilityV2");
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
      },
      correlation: trace,
    });
    expect(ctx.metadata.version).toBe(BOOKING_DOMAIN_VERSION);
    expect(ctx.state.status).toBe("scheduled");
    expect(ctx.correlation.bookingOperationId).toBe(trace.bookingOperationId);
  });
});

describe("Booking State Machine", () => {
  it("exposes schedule-only statuses", () => {
    expect(BOOKING_STATUSES).toContain("draft");
    expect(BOOKING_STATUSES).toContain("waiting_assignment");
    expect(BOOKING_STATUSES).not.toContain("in_progress");
    expect(SLOT_OCCUPYING_STATUSES).toContain("confirmed");
  });

  it("allows valid schedule transitions", () => {
    expect(canTransition("draft", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "waiting_assignment")).toBe(true);
    expect(canTransition("scheduled", "cancelled")).toBe(true);
    expect(BOOKING_TRANSITIONS.waiting_assignment).toContain("rescheduled");
  });

  it("rejects invalid transitions", () => {
    expect(() => validateTransition("draft", "waiting_assignment")).toThrow(BookingStateMachineError);
    expect(() => validateTransition("cancelled", "scheduled")).toThrow(BookingStateMachineError);
  });

  it("classifies terminal and active statuses", () => {
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("confirmed")).toBe(false);
    expect(isActiveScheduleStatus("waiting_assignment")).toBe(true);
    expect(isActiveScheduleStatus("cancelled")).toBe(false);
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
        booking: { id: 1, customerId: 1, serviceType: "car_wash", scheduledDate: "2026-07-16", status: "draft" },
        correlation: trace,
      }),
    });
    expect(received).toEqual(["BookingCreated"]);
  });
});

describe("Schedule-only status model", () => {
  it("covers every BookingStatus in transitions map", () => {
    for (const status of BOOKING_STATUSES) {
      expect(BOOKING_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(BOOKING_TRANSITIONS[status])).toBe(true);
    }
  });
});
