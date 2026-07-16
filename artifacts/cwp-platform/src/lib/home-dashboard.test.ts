import { describe, expect, it } from "vitest";
import { buildHomeDashboard, pickPrimaryPlan } from "@/lib/home-dashboard";
import { subscriptionToPlan, type RawSubscription } from "@/lib/customer-plans";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

function sub(partial: Partial<RawSubscription> & { id: number }): RawSubscription {
  return {
    type: "monthly_wash",
    status: "active",
    serviceName: "Monthly Wash",
    totalServices: 12,
    servicesRemaining: 5,
    ...partial,
  };
}

describe("pickPrimaryPlan", () => {
  it("prefers renewal-due plan", () => {
    const plans = [
      subscriptionToPlan(sub({ id: 1, status: "active" })),
      subscriptionToPlan(sub({ id: 2, status: "expiring", serviceName: "Solar AMC", type: "solar_amc" })),
    ];
    expect(pickPrimaryPlan(plans)?.id).toBe(2);
  });
});

describe("buildHomeDashboard", () => {
  it("surfaces track CTA when service is en route", () => {
    const model = buildHomeDashboard({
      recentBookings: [{
        id: 42,
        customerId: 1,
        scheduledDate: "2026-07-16",
        status: "en_route",
        serviceType: "car_wash",
        serviceName: "Premium Wash",
        address: "12 MG Road",
        vehicleInfo: "Swift · UP32AB1234",
      }],
      pendingDues: 0,
      subscriptions: [],
      hasPendingFeedback: false,
      vehicles: [],
      solarSites: [],
    });
    expect(model.cta.label).toBe("Track Today's Service");
    expect(model.cta.href).toBe(CUSTOMER_ROUTES.scheduledServiceDetail(42));
    expect(model.currentAddress.line).toBe("12 MG Road");
  });

  it("defaults to schedule CTA for new customer with assets", () => {
    const model = buildHomeDashboard({
      recentBookings: [],
      pendingDues: 0,
      subscriptions: [],
      hasPendingFeedback: false,
      vehicles: [{ id: 1, registrationNumber: "UP32AB1234", serviceAddress: "Home" }],
      solarSites: [],
    });
    expect(model.cta.label).toBe("Purchase Plan");
    expect(model.cta.href).toBe(CUSTOMER_ROUTES.plans);
  });

  it("uses invoice CTA when dues outstanding", () => {
    const model = buildHomeDashboard({
      recentBookings: [],
      pendingDues: 500,
      subscriptions: [sub({ id: 1 })],
      hasPendingFeedback: false,
      vehicles: [{ id: 1, registrationNumber: "UP1" }],
      solarSites: [],
    });
    expect(model.cta.label).toBe("View Your Bill");
  });
});
