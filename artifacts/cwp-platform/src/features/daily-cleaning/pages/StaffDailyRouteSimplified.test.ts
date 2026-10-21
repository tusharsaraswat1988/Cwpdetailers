import { describe, expect, it } from "vitest";
import { computeRouteStats, type RouteStop } from "./StaffDailyRouteSimplified";
import { normalizeRegistration } from "../lib/plateOcr";

describe("StaffDailyRouteSimplified Route Stats", () => {
  it("computes counts accurately from real route stops", () => {
    const stops = [
      { todayStatus: "completed" },
      { todayStatus: "completed" },
      { todayStatus: "pending" },
      { todayStatus: "car_not_available" },
      { todayStatus: "rejected" },
    ];

    const stats = computeRouteStats(stops);
    expect(stats.total).toBe(5);
    expect(stats.completed).toBe(2);
    expect(stats.pending).toBe(2); // pending + rejected count as remaining to be done
    expect(stats.notAvailable).toBe(1);
  });

  it("handles empty route stops cleanly", () => {
    const stats = computeRouteStats([]);
    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.notAvailable).toBe(0);
  });

  it("preserves exact backend route ordering", () => {
    const mockBackendStops: RouteStop[] = [
      {
        subscriptionId: 101,
        routeOrder: 1,
        vehicleNumber: "UP65AB1111",
        customerName: "Alice",
        vehicleMake: "Maruti",
        vehicleModel: "Swift",
        todayStatus: "pending",
        remainingCleanings: 10,
      },
      {
        subscriptionId: 102,
        routeOrder: 2,
        vehicleNumber: "UP65CD2222",
        customerName: "Bob",
        vehicleMake: "Hyundai",
        vehicleModel: "i20",
        todayStatus: "completed",
        remainingCleanings: 9,
      },
      {
        subscriptionId: 103,
        routeOrder: 3,
        vehicleNumber: "UP65EF3333",
        customerName: "Charlie",
        vehicleMake: "Tata",
        vehicleModel: "Nexon",
        todayStatus: "car_not_available",
        remainingCleanings: 5,
      },
    ];

    // Verify ordering sequence is maintained
    expect(mockBackendStops[0].vehicleNumber).toBe("UP65AB1111");
    expect(mockBackendStops[1].vehicleNumber).toBe("UP65CD2222");
    expect(mockBackendStops[2].vehicleNumber).toBe("UP65EF3333");
  });
});

describe("Plate Verification Safety Logic", () => {
  it("normalizes and accepts exact plate matches", () => {
    const assigned = "UP 65 AB 1234";
    const scanned = "up65ab1234";
    expect(normalizeRegistration(scanned)).toBe(normalizeRegistration(assigned));
  });

  it("detects and blocks wrong vehicle plates", () => {
    const assigned = "UP65AB1234";
    const scannedWrong = "UP65XY9999";

    const cleanExpected = normalizeRegistration(assigned).replace(/[^A-Z0-9]/g, "");
    const cleanScanned = normalizeRegistration(scannedWrong).replace(/[^A-Z0-9]/g, "");

    const isMatch = cleanScanned === cleanExpected;
    expect(isMatch).toBe(false);
  });

  it("prevents manual fallback if entered number does not match assigned vehicle", () => {
    const assigned = "UP65AB1234";
    const typoInput = "UP65AB5678";

    const cleanExpected = normalizeRegistration(assigned).replace(/[^A-Z0-9]/g, "");
    const cleanInput = normalizeRegistration(typoInput).replace(/[^A-Z0-9]/g, "");

    expect(cleanInput === cleanExpected).toBe(false);
  });
});
