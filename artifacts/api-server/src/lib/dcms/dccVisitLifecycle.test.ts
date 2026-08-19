import { describe, expect, it } from "vitest";
import {
  applyEntitlementDelta,
  customerVisitHeadline,
  isPresentVisitStatus,
  planCarNotAvailable,
  planCompleteCleaning,
  shouldRecordMissedVisit,
  staffPerformanceFromCounts,
  CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE,
  CUSTOMER_HEADLINE_COMPLETED,
  type PresentVisitRef,
} from "./visitOutcomes";

/**
 * In-memory DCC day simulator — same write plans visitService executes.
 * Covers remainingCleanings, visit identity, EOD missed, customer headline, performance.
 */
type DayState = {
  remainingCleanings: number;
  usedCleanings: number;
  remainingWashes: number;
  usedWashes: number;
  visits: Array<PresentVisitRef & { photoRequired: boolean }>;
  nextId: number;
  missed: boolean;
  activity: string[];
};

function newDay(remainingCleanings = 16): DayState {
  return {
    remainingCleanings,
    usedCleanings: 10,
    remainingWashes: 3,
    usedWashes: 1,
    visits: [],
    nextId: 1,
    missed: false,
    activity: [],
  };
}

function consumeCompletedCleaning(state: DayState) {
  const next = applyEntitlementDelta({
    usedCleanings: state.usedCleanings,
    remainingCleanings: state.remainingCleanings,
    usedWashes: state.usedWashes,
    remainingWashes: state.remainingWashes,
  }, "cleaning", "completed");
  state.usedCleanings = next.usedCleanings;
  state.remainingCleanings = next.remainingCleanings;
  state.usedWashes = next.usedWashes;
  state.remainingWashes = next.remainingWashes;
}

function recordCarNotAvailable(state: DayState) {
  const plan = planCarNotAvailable(state.visits);
  if (plan.action === "reject") throw new Error(plan.error);
  if (plan.action === "return") return { visitId: plan.visitId, idempotent: true };
  const visit = { id: state.nextId++, status: "car_not_available", photoRequired: true };
  state.visits.push(visit);
  state.activity.push("visit_car_not_available");
  return { visitId: visit.id, idempotent: false };
}

function completeCleaning(state: DayState) {
  const plan = planCompleteCleaning(state.visits);
  if (plan.action === "reject") throw new Error(plan.error);
  if (plan.action === "return") return { visitId: plan.visitId, idempotent: true, consumed: false };

  if (plan.action === "update") {
    const visit = state.visits.find(v => v.id === plan.visitId);
    if (!visit) throw new Error("Visit not found");
    visit.status = "completed";
    visit.photoRequired = true;
    consumeCompletedCleaning(state);
    state.activity.push("visit_recovered_from_car_not_available");
    state.activity.push("cleaning_consumed");
    return { visitId: visit.id, idempotent: false, consumed: true };
  }

  const visit = { id: state.nextId++, status: "completed", photoRequired: true };
  state.visits.push(visit);
  consumeCompletedCleaning(state);
  state.activity.push("cleaning_consumed");
  return { visitId: visit.id, idempotent: false, consumed: true };
}

function runEod(state: DayState, expectedToday = true) {
  state.missed = shouldRecordMissedVisit({
    expectedToday,
    hasPresentVisit: state.visits.some(v => isPresentVisitStatus(v.status)),
  });
}

function customerLatestHeadline(state: DayState) {
  const completed = state.visits.find(v => v.status === "completed");
  const shown = completed ?? state.visits.find(v => v.status === "car_not_available");
  return shown ? customerVisitHeadline(shown.status, "cleaning") : null;
}

function performance(state: DayState) {
  return staffPerformanceFromCounts({
    completed: state.visits.filter(v => v.status === "completed").length,
    carNotAvailable: state.visits.filter(v => v.status === "car_not_available").length,
    rejected: 0,
    missed: state.missed ? 1 : 0,
  });
}

describe("DCC lifecycle A — car not available is not missed", () => {
  it("keeps one CNA visit, does not consume, and EOD does not mark missed", () => {
    const day = newDay(16);
    const first = recordCarNotAvailable(day);
    runEod(day);

    expect(day.visits).toHaveLength(1);
    expect(day.visits[0]!.id).toBe(first.visitId);
    expect(day.visits[0]!.status).toBe("car_not_available");
    expect(day.visits[0]!.photoRequired).toBe(true);
    expect(day.remainingCleanings).toBe(16);
    expect(day.remainingWashes).toBe(3);
    expect(day.missed).toBe(false);
    expect(customerLatestHeadline(day)).toBe(CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE);
    expect(performance(day).completedVisits).toBe(0);
    expect(performance(day).carNotAvailableVisits).toBe(1);
    expect(performance(day).missedVisits).toBe(0);
  });
});

describe("DCC lifecycle B — completed cleaning", () => {
  it("requires photos, consumes exactly one cleaning, and counts as completed", () => {
    const day = newDay(16);
    completeCleaning(day);
    runEod(day);

    expect(day.visits).toHaveLength(1);
    expect(day.visits[0]!.status).toBe("completed");
    expect(day.visits[0]!.photoRequired).toBe(true);
    expect(day.remainingCleanings).toBe(15);
    expect(day.usedCleanings).toBe(11);
    expect(day.remainingWashes).toBe(3);
    expect(day.missed).toBe(false);
    expect(customerLatestHeadline(day)).toBe(CUSTOMER_HEADLINE_COMPLETED);
    expect(performance(day).completedVisits).toBe(1);
    expect(performance(day).carNotAvailableVisits).toBe(0);
  });
});

describe("DCC lifecycle C — same-day car becomes available", () => {
  it("updates the same visit to completed and consumes exactly one cleaning", () => {
    const day = newDay(16);
    const cna = recordCarNotAvailable(day);
    const done = completeCleaning(day);
    runEod(day);

    expect(done.visitId).toBe(cna.visitId);
    expect(day.visits).toHaveLength(1);
    expect(day.visits[0]!.status).toBe("completed");
    expect(day.visits[0]!.photoRequired).toBe(true);
    expect(day.remainingCleanings).toBe(15);
    expect(day.remainingWashes).toBe(3);
    expect(day.missed).toBe(false);
    expect(customerLatestHeadline(day)).toBe(CUSTOMER_HEADLINE_COMPLETED);
    expect(customerLatestHeadline(day)).not.toBe(CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE);
    expect(day.activity).toContain("visit_car_not_available");
    expect(day.activity).toContain("visit_recovered_from_car_not_available");
    expect(performance(day).completedVisits).toBe(1);
    expect(performance(day).carNotAvailableVisits).toBe(0);
    expect(performance(day).missedVisits).toBe(0);

    const todayOps = {
      completed: performance(day).completedVisits,
      carNotAvailable: performance(day).carNotAvailableVisits,
      stillPending: 0,
    };
    expect(todayOps).toEqual({ completed: 1, carNotAvailable: 0, stillPending: 0 });
  });

  it("does not allow completed → car_not_available", () => {
    const day = newDay();
    completeCleaning(day);
    expect(() => recordCarNotAvailable(day)).toThrow(/already completed/i);
    expect(day.visits).toHaveLength(1);
    expect(day.remainingCleanings).toBe(15);
  });
});

describe("DCC lifecycle D — double-submit car not available", () => {
  it("creates exactly one visit and does not consume a cleaning", () => {
    const day = newDay(16);
    const a = recordCarNotAvailable(day);
    const b = recordCarNotAvailable(day);
    expect(b.idempotent).toBe(true);
    expect(b.visitId).toBe(a.visitId);
    expect(day.visits).toHaveLength(1);
    expect(day.remainingCleanings).toBe(16);
  });
});

describe("DCC lifecycle E — double-submit complete", () => {
  it("creates exactly one visit and consumes exactly one cleaning", () => {
    const day = newDay(16);
    const a = completeCleaning(day);
    const b = completeCleaning(day);
    expect(b.idempotent).toBe(true);
    expect(b.consumed).toBe(false);
    expect(b.visitId).toBe(a.visitId);
    expect(day.visits).toHaveLength(1);
    expect(day.remainingCleanings).toBe(15);
    expect(day.usedCleanings).toBe(11);
  });

  it("double-submit after same-day recovery still consumes only once", () => {
    const day = newDay(16);
    recordCarNotAvailable(day);
    completeCleaning(day);
    completeCleaning(day);
    expect(day.visits).toHaveLength(1);
    expect(day.remainingCleanings).toBe(15);
  });
});
