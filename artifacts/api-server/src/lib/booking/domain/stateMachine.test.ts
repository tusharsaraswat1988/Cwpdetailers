import { describe, expect, it } from "vitest";
import {
  BOOKING_TRANSITIONS,
  canTransition,
  validateTransition,
  BookingStateMachineError,
  isTerminalStatus,
} from "./stateMachine";
import { checkSlotCapacity } from "../scheduling/CapacityPolicy";

describe("Phase 5.2 booking state machine", () => {
  it("allows draft → scheduled → confirmed → waiting_assignment", () => {
    expect(canTransition("draft", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "waiting_assignment")).toBe(true);
  });

  it("allows scheduled → waiting_assignment directly", () => {
    expect(canTransition("scheduled", "waiting_assignment")).toBe(true);
  });

  it("rejects execution statuses (not in machine)", () => {
    expect(BOOKING_TRANSITIONS.confirmed).not.toContain("en_route" as never);
    expect(BOOKING_TRANSITIONS.waiting_assignment).toEqual(["rescheduled", "cancelled"]);
  });

  it("throws on invalid transition", () => {
    expect(() => validateTransition("cancelled", "confirmed")).toThrow(BookingStateMachineError);
  });

  it("treats cancelled as terminal", () => {
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("waiting_assignment")).toBe(false);
  });
});

describe("CapacityPolicy", () => {
  it("reports available when under max", async () => {
    const result = await checkSlotCapacity({
      scheduledDate: "2026-07-20",
      scheduledTime: "10:00",
      currentCount: 3,
    });
    expect(result.available).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("reports unavailable at capacity", async () => {
    const { setCapacityProvider, DefaultCapacityProvider, resetCapacityProvider } = await import("../scheduling/CapacityProvider");
    setCapacityProvider(new DefaultCapacityProvider(2));
    try {
      const result = await checkSlotCapacity({
        scheduledDate: "2026-07-20",
        scheduledTime: "10:00",
        currentCount: 2,
      });
      expect(result.available).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.maxConcurrent).toBe(2);
    } finally {
      resetCapacityProvider();
    }
  });
});

describe("TimeWindow", () => {
  it("resolves variable duration windows", async () => {
    const { resolveTimeWindow, windowsOverlap } = await import("../scheduling/TimeWindow");
    const w = resolveTimeWindow({
      scheduledDate: "2026-07-20",
      scheduledTime: "10:00",
      durationMinutes: 90,
    });
    expect(w.durationMinutes).toBe(90);
    expect(w.scheduledEndAt.getTime() - w.scheduledStartAt.getTime()).toBe(90 * 60_000);

    const other = resolveTimeWindow({
      scheduledDate: "2026-07-20",
      scheduledTime: "11:00",
      durationMinutes: 60,
    });
    expect(windowsOverlap(w.scheduledStartAt, w.scheduledEndAt, other.scheduledStartAt, other.scheduledEndAt)).toBe(true);
  });
});
