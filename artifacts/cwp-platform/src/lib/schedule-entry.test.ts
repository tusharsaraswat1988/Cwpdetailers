import { describe, expect, it } from "vitest";
import type { RawSubscription } from "@/lib/customer-plans";
import {
  buildScheduleEntryUrl,
  parseScheduleEntryParams,
  resolveAssetFromEntry,
  resolveBookingAddressForEntry,
  resolvePlanFromEntry,
  resolveScheduleEntryContext,
} from "@/lib/schedule-entry";

const vehicles = [
  {
    id: 10,
    make: "Swift",
    model: "VXI",
    registrationNumber: "UP32AB1234",
    serviceAddress: "12 MG Road",
    serviceLat: 25.3,
    serviceLng: 82.9,
  },
  {
    id: 20,
    make: "City",
    model: "ZX",
    registrationNumber: "UP32CD5678",
    serviceAddress: "45 Assi Road",
    serviceLat: 25.28,
    serviceLng: 82.95,
  },
];

const solarSites = [
  {
    id: 5,
    address: "Rooftop Solar, Lanka",
    panelCount: 12,
    serviceLat: 25.29,
    serviceLng: 82.91,
  },
];

const subs: RawSubscription[] = [
  { id: 1, type: "monthly_wash", status: "active", vehicleId: 10, totalServices: 5, servicesRemaining: 3 },
  { id: 2, type: "solar_amc", status: "active", solarSiteId: 5, totalServices: 4, servicesRemaining: 2 },
];

describe("schedule-entry", () => {
  it("builds canonical schedule URLs", () => {
    expect(buildScheduleEntryUrl({ planId: 1, from: "home" }))
      .toBe("/customer/schedule?planId=1&from=home");
    expect(buildScheduleEntryUrl({ vehicleId: 10, planId: 1, from: "assets" }))
      .toBe("/customer/schedule?vehicleId=10&planId=1&from=assets");
  });

  it("parses entry params from search string", () => {
    const params = parseScheduleEntryParams("?planId=2&solarSiteId=5&from=plans");
    expect(params).toEqual({ planId: 2, solarSiteId: 5, from: "plans" });
  });

  it("resolves asset from planId (vehicle) before single-asset hint", () => {
    const asset = resolveAssetFromEntry({
      params: { planId: 1 },
      vehicles,
      solarSites,
      subscriptions: subs,
      singleAssetHint: { assetId: 20, kind: "vehicle" },
    });
    expect(asset?.id).toBe(10);
    expect(asset?.kind).toBe("vehicle");
  });

  it("resolves asset from planId (solar)", () => {
    const asset = resolveAssetFromEntry({
      params: { planId: 2 },
      vehicles,
      solarSites,
      subscriptions: subs,
    });
    expect(asset?.id).toBe(5);
    expect(asset?.kind).toBe("solar");
  });

  it("explicit vehicleId wins over plan asset", () => {
    const asset = resolveAssetFromEntry({
      params: { planId: 1, vehicleId: 20 },
      vehicles,
      solarSites,
      subscriptions: subs,
    });
    expect(asset?.id).toBe(20);
  });

  it("skips plan step when planId provided from My Plans", () => {
    const ctx = resolveScheduleEntryContext({
      params: parseScheduleEntryParams("?planId=1&from=plans"),
      vehicles,
      solarSites,
      subscriptions: subs,
    });
    expect(ctx.planMode).toBe("plan");
    expect(ctx.selectedPlan?.id).toBe(1);
    expect(ctx.asset?.id).toBe(10);
    expect(ctx.initialStep).toBe("service");
  });

  it("skips asset and plan from Assets entry with vehicle + plan", () => {
    const ctx = resolveScheduleEntryContext({
      params: parseScheduleEntryParams("?vehicleId=10&planId=1&from=assets"),
      vehicles,
      solarSites,
      subscriptions: subs,
    });
    expect(ctx.asset?.id).toBe(10);
    expect(ctx.planMode).toBe("plan");
    expect(ctx.initialStep).toBe("service");
  });

  it("home entry with planId lands on service step", () => {
    const ctx = resolveScheduleEntryContext({
      params: parseScheduleEntryParams("?planId=1&from=home"),
      vehicles,
      solarSites,
      subscriptions: subs,
    });
    expect(ctx.initialStep).toBe("service");
    expect(ctx.address?.address).toBe("12 MG Road");
  });

  it("fab entry with multiple assets starts at asset step", () => {
    const ctx = resolveScheduleEntryContext({
      params: parseScheduleEntryParams("?from=fab"),
      vehicles,
      solarSites,
      subscriptions: subs,
    });
    expect(ctx.asset).toBeNull();
    expect(ctx.planMode).toBeNull();
    expect(ctx.initialStep).toBe("asset");
  });

  it("prefers asset location over mismatched selected address", () => {
    const asset = resolveAssetFromEntry({
      params: { vehicleId: 10 },
      vehicles,
      solarSites,
      subscriptions: subs,
    })!;
    const address = resolveBookingAddressForEntry({
      asset,
      selectedAddress: {
        address: "Wrong place",
        latitude: 1,
        longitude: 2,
        assetId: 20,
        assetType: "vehicle",
      },
    });
    expect(address?.address).toBe("12 MG Road");
  });

  it("resolves one_time mode from plans empty state", () => {
    const plan = resolvePlanFromEntry({
      params: { mode: "one_time", from: "plans" },
      subscriptions: subs,
    });
    expect(plan.planMode).toBe("one_time");
  });
});
