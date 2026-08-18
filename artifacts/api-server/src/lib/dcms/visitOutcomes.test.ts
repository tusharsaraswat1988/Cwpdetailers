import { describe, expect, it } from "vitest";
import {
  applyEntitlementDelta,
  attendanceFromVisitStatus,
  canRecordCarNotAvailable,
  classifyRouteStop,
  classifyTodayOutcome,
  consumesCleaningEntitlement,
  consumesWashEntitlement,
  customerVisitHeadline,
  isPresentVisitStatus,
  photosRequiredForOutcome,
  planCarNotAvailable,
  planCompleteCleaning,
  shouldRecordMissedVisit,
  staffPerformanceFromCounts,
  CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE,
  CUSTOMER_HEADLINE_COMPLETED,
} from "./visitOutcomes";

const sub = {
  usedCleanings: 10,
  remainingCleanings: 16,
  usedWashes: 1,
  remainingWashes: 3,
};

describe("DCC completed visit", () => {
  it("records presence, requires photos, and consumes a cleaning not a wash", () => {
    expect(attendanceFromVisitStatus("completed")).toBe("present");
    expect(photosRequiredForOutcome("completed")).toBe(true);
    expect(consumesCleaningEntitlement("cleaning", "completed")).toBe(true);
    expect(consumesWashEntitlement("cleaning", "completed")).toBe(false);

    const next = applyEntitlementDelta(sub, "cleaning", "completed");
    expect(next.consumedCleaning).toBe(true);
    expect(next.consumedWash).toBe(false);
    expect(next.remainingCleanings).toBe(15);
    expect(next.usedCleanings).toBe(11);
    expect(next.remainingWashes).toBe(3);
    expect(next.usedWashes).toBe(1);
  });

  it("treats a second completed punch as idempotent, not a new visit", () => {
    const plan = planCompleteCleaning([{ id: 1, status: "completed" }]);
    expect(plan).toEqual({ action: "return", visitId: 1 });
  });
});

describe("DCC car not available", () => {
  it("records presence without photos, cleaning, wash, or absence", () => {
    expect(attendanceFromVisitStatus("car_not_available")).toBe("present");
    expect(photosRequiredForOutcome("car_not_available")).toBe(false);
    expect(consumesCleaningEntitlement("cleaning", "car_not_available")).toBe(false);
    expect(consumesWashEntitlement("cleaning", "car_not_available")).toBe(false);
    expect(consumesWashEntitlement("wash", "car_not_available")).toBe(false);

    const next = applyEntitlementDelta(sub, "cleaning", "car_not_available");
    expect(next.consumedCleaning).toBe(false);
    expect(next.consumedWash).toBe(false);
    expect(next.remainingCleanings).toBe(16);
    expect(next.remainingWashes).toBe(3);
  });

  it("is not treated as a missed/absent stop", () => {
    expect(classifyRouteStop("car_not_available", true)).toBe("car_not_available");
    expect(shouldRecordMissedVisit({
      expectedToday: true,
      hasPresentVisit: isPresentVisitStatus("car_not_available"),
    })).toBe(false);
  });

  it("treats a second car-not-available punch as idempotent, not a new visit", () => {
    const plan = planCarNotAvailable([{ id: 4, status: "car_not_available" }]);
    expect(plan).toEqual({ action: "return", visitId: 4 });
  });

  it("blocks car-not-available after a completed cleaning", () => {
    expect(canRecordCarNotAvailable(["completed"]).ok).toBe(false);
  });
});

describe("DCC genuinely missed / absent", () => {
  it("stays distinguishable from car not available", () => {
    expect(classifyRouteStop(undefined, true)).toBe("missed");
    expect(classifyRouteStop("car_not_available", true)).not.toBe("missed");
    expect(attendanceFromVisitStatus(undefined)).toBe("not_present");
    expect(attendanceFromVisitStatus("rejected")).toBe("not_present");
    expect(shouldRecordMissedVisit({ expectedToday: true, hasPresentVisit: false })).toBe(true);
    expect(shouldRecordMissedVisit({ expectedToday: true, hasPresentVisit: true })).toBe(false);
  });
});

describe("customer history copy", () => {
  it("uses simple language for completed vs car unavailable", () => {
    expect(customerVisitHeadline("completed", "cleaning")).toBe(CUSTOMER_HEADLINE_COMPLETED);
    expect(customerVisitHeadline("car_not_available")).toBe(CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE);
    expect(customerVisitHeadline("completed", "cleaning")).not.toBe(
      customerVisitHeadline("car_not_available"),
    );
  });
});

describe("staff performance", () => {
  it("does not count completed and car-unavailable as the same thing", () => {
    const metrics = staffPerformanceFromCounts({
      completed: 87,
      carNotAvailable: 9,
      rejected: 2,
      missed: 2,
    });
    expect(metrics.completedVisits).toBe(87);
    expect(metrics.carNotAvailableVisits).toBe(9);
    expect(metrics.missedVisits).toBe(2);
    expect(metrics.completionPercentage).toBe(Math.round(87 / (87 + 2 + 2) * 100));
  });

  it("does not treat car-unavailable as absence in the completion rate", () => {
    const withCna = staffPerformanceFromCounts({
      completed: 10,
      carNotAvailable: 5,
      rejected: 0,
      missed: 0,
    });
    const withoutCna = staffPerformanceFromCounts({
      completed: 10,
      carNotAvailable: 0,
      rejected: 0,
      missed: 0,
    });
    expect(withCna.completionPercentage).toBe(withoutCna.completionPercentage);
    expect(withCna.completionPercentage).toBe(100);
  });
});

describe("daily scheduling / existing subscriptions", () => {
  it("keeps generating missed only when a present visit is missing", () => {
    expect(shouldRecordMissedVisit({ expectedToday: true, hasPresentVisit: false })).toBe(true);
    expect(shouldRecordMissedVisit({ expectedToday: false, hasPresentVisit: false })).toBe(false);
    expect(shouldRecordMissedVisit({
      expectedToday: true,
      hasPresentVisit: isPresentVisitStatus("completed"),
    })).toBe(false);
  });

  it("interprets historical completed rows as present + completed", () => {
    expect(classifyTodayOutcome("completed")).toBe("completed");
    expect(attendanceFromVisitStatus("completed")).toBe("present");
    const next = applyEntitlementDelta(sub, "cleaning", "completed");
    expect(next.consumedCleaning).toBe(true);
  });

  it("plans CNA → COMPLETED as an update of the same visit", () => {
    expect(planCompleteCleaning([{ id: 9, status: "car_not_available" }])).toEqual({
      action: "update",
      visitId: 9,
    });
  });
});

describe("completed wash vs DCC", () => {
  it("only a completed wash consumes wash entitlement", () => {
    const wash = applyEntitlementDelta(sub, "wash", "completed");
    expect(wash.consumedWash).toBe(true);
    expect(wash.consumedCleaning).toBe(false);
    expect(wash.remainingWashes).toBe(2);

    const cna = applyEntitlementDelta(sub, "cleaning", "car_not_available");
    expect(cna.consumedWash).toBe(false);
  });
});
