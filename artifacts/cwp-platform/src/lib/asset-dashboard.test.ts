import { describe, expect, it } from "vitest";
import { buildAssetsDashboard, formatRelativePast } from "@/lib/asset-dashboard";
import type { RawSubscription } from "@/lib/customer-plans";

describe("formatRelativePast", () => {
  it("returns null for empty input", () => {
    expect(formatRelativePast(null)).toBeNull();
  });
});

describe("buildAssetsDashboard", () => {
  it("groups vehicles and solar separately", () => {
    const model = buildAssetsDashboard({
      vehicles: [{ id: 1, make: "Maruti", model: "Swift", registrationNumber: "UP32AB1234", serviceAddress: "Home", locationComplete: true }],
      solarSites: [{ id: 2, address: "Rooftop", panelCount: 48 }],
      subscriptions: [],
      bookings: [],
    });
    expect(model.vehicles).toHaveLength(1);
    expect(model.solarSites).toHaveLength(1);
    expect(model.totalCount).toBe(2);
    expect(model.singleAssetId).toBeNull();
  });

  it("marks single asset for schedule preselect", () => {
    const model = buildAssetsDashboard({
      vehicles: [{ id: 5, make: "Honda", model: "City", registrationNumber: "UP1", serviceAddress: "Addr" }],
      solarSites: [],
      subscriptions: [],
      bookings: [],
    });
    expect(model.singleAssetId).toBe(5);
    expect(model.singleAssetKind).toBe("vehicle");
  });

  it("links plan by vehicleId", () => {
    const subs: RawSubscription[] = [{
      id: 10,
      type: "monthly_wash",
      status: "active",
      vehicleId: 1,
      serviceName: "Monthly Wash",
      totalServices: 12,
      servicesRemaining: 8,
    }];
    const model = buildAssetsDashboard({
      vehicles: [{ id: 1, make: "Maruti", model: "Swift", registrationNumber: "UP1", serviceAddress: "Home", locationComplete: true }],
      solarSites: [],
      subscriptions: subs,
      bookings: [],
    });
    expect(model.vehicles[0].plan?.id).toBe(10);
    expect(model.vehicles[0].healthLabel).toBe("Protected by Active Plan");
  });
});
