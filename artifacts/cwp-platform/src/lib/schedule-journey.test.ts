import { describe, expect, it } from "vitest";
import {
  plansForAsset,
  resolveActiveStep,
  filterServicesForCoverage,
  inferPlanMode,
  shouldSkipStep,
} from "@/lib/schedule-journey";
import type { RawSubscription } from "@/lib/customer-plans";
import { buildAvailableDates, firstAvailableDate, slotsForDate } from "@/lib/schedule-slots";

describe("schedule-journey", () => {
  it("filters plans by vehicleId", () => {
    const subs: RawSubscription[] = [
      { id: 1, type: "monthly_wash", status: "active", vehicleId: 10, totalServices: 5, servicesRemaining: 3 },
      { id: 2, type: "monthly_wash", status: "active", vehicleId: 20, totalServices: 5, servicesRemaining: 2 },
    ];
    const plans = plansForAsset(subs, {
      kind: "vehicle", id: 10, name: "Swift", subtitle: "UP1", location: null,
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe(1);
  });

  it("skips asset step when one asset", () => {
    expect(shouldSkipStep("asset", {
      assetCount: 1,
      asset: { kind: "vehicle", id: 1, name: "X", subtitle: "", location: null },
      eligiblePlanCount: 0,
      planMode: "one_time",
      selectedPlan: null,
      serviceCount: 1,
      serviceSelected: false,
      dateSelected: false,
      timeSelected: false,
    })).toBe(true);
  });

  it("resolves to plan step when multiple plans", () => {
    const step = resolveActiveStep({
      assetCount: 2,
      asset: { kind: "vehicle", id: 1, name: "X", subtitle: "", location: null },
      eligiblePlanCount: 2,
      planMode: null,
      selectedPlan: null,
      serviceCount: 0,
      serviceSelected: false,
      dateSelected: false,
      timeSelected: false,
    });
    expect(step).toBe("plan");
  });

  it("infers one_time when no plans", () => {
    expect(inferPlanMode(0)).toBe("one_time");
  });

  it("filters solar services from catalog", () => {
    const filtered = filterServicesForCoverage(
      [
        { id: 1, name: "Wash", category: "car_wash", basePrice: "100" },
        { id: 2, name: "Solar", category: "solar_cleaning", basePrice: "200" },
      ],
      [{ id: 1, name: "Wash", slug: "wash" }, { id: 2, name: "Solar", slug: "solar" }],
      "solar",
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });
});

describe("schedule-slots", () => {
  it("disables Sundays", () => {
    const dates = buildAvailableDates(7);
    const sundays = dates.filter(d => d.disabled);
    expect(sundays.some(d => d.reason?.includes("Sunday"))).toBe(true);
  });

  it("returns first available date", () => {
    const dates = buildAvailableDates(7);
    expect(firstAvailableDate(dates)).toBeTruthy();
  });

  it("filters past time slots for today", () => {
    const slots = slotsForDate("2026-07-16", new Date("2026-07-16T20:00:00"));
    expect(slots.every(s => parseInt(s.split(":")[0]) > 20)).toBe(true);
  });
});
