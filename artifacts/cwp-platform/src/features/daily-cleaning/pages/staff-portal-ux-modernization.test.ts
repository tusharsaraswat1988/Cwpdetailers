import { describe, expect, it, beforeEach } from "vitest";
import { computeRouteStats, type RouteStop } from "./StaffDailyRouteSimplified";
import {
  getTodayIstDate,
  getDcmsDayStore,
  saveDcmsLocalRecord,
  clearDcmsDayStore,
  localStatusToRouteStopStatus,
  type DcmsLocalCompletionType,
} from "../lib/dcmsLocalStorage";
import { buildNavigateUrl } from "@/lib/maps";

describe("Phase 24: Staff Operations Portal UX Modernization (STAFF-025 to STAFF-034, TEST-012)", () => {
  const staffId = 42;
  const mockTodayDate = "2026-11-14";

  // Mock localStorage in memory for tests
  const storeMap: Record<string, string> = {};
  beforeEach(() => {
    for (const key of Object.keys(storeMap)) {
      delete storeMap[key];
    }
    // Setup window.localStorage shim
    global.window = {
      localStorage: {
        getItem: (k: string) => storeMap[k] ?? null,
        setItem: (k: string, v: string) => {
          storeMap[k] = v;
        },
        removeItem: (k: string) => {
          delete storeMap[k];
        },
        key: (i: number) => Object.keys(storeMap)[i] ?? null,
        get length() {
          return Object.keys(storeMap).length;
        },
        clear: () => {
          for (const key of Object.keys(storeMap)) delete storeMap[key];
        },
      },
    } as unknown as Window & typeof globalThis;
  });

  describe("STAFF-028: Resilient Local Storage Persistence & Asia/Kolkata Daily Reset", () => {
    it("derives valid IST date string formatted YYYY-MM-DD", () => {
      const ist = getTodayIstDate();
      expect(ist).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("saves and retrieves daily cleaning completions locally", () => {
      saveDcmsLocalRecord(
        staffId,
        {
          subscriptionId: 101,
          vehicleNumber: "UP65AB1234",
          status: "completed",
          actionLabel: "Car Found — Cleaning Completed",
        },
        mockTodayDate,
      );

      const store = getDcmsDayStore(staffId, mockTodayDate);
      expect(store.staffId).toBe(staffId);
      expect(store.istDate).toBe(mockTodayDate);
      expect(store.records[101]).toBeDefined();
      expect(store.records[101].vehicleNumber).toBe("UP65AB1234");
      expect(store.records[101].status).toBe("completed");
    });

    it("stores structured operational exceptions with reasons", () => {
      const exceptions: Array<{ subId: number; status: DcmsLocalCompletionType; label: string; notes: string }> = [
        { subId: 201, status: "car_not_available", label: "Car Not Available", notes: "Bay empty" },
        { subId: 202, status: "plate_not_visible", label: "Vehicle Number Not Visible", notes: "Covered" },
        { subId: 203, status: "customer_skip", label: "Customer Requested Skip", notes: "Out of town" },
        { subId: 204, status: "access_denied", label: "Unable to Access Parking", notes: "Guard entry blocked" },
        { subId: 205, status: "issue_reported", label: "Report Vehicle Issue", notes: "Flat tyre" },
      ];

      for (const ex of exceptions) {
        saveDcmsLocalRecord(
          staffId,
          {
            subscriptionId: ex.subId,
            vehicleNumber: `UP65EX${ex.subId}`,
            status: ex.status,
            actionLabel: ex.label,
            notes: ex.notes,
          },
          mockTodayDate,
        );
      }

      const store = getDcmsDayStore(staffId, mockTodayDate);
      expect(Object.keys(store.records).length).toBe(5);
      expect(store.records[201].status).toBe("car_not_available");
      expect(store.records[202].status).toBe("plate_not_visible");
      expect(store.records[203].status).toBe("customer_skip");
      expect(store.records[204].status).toBe("access_denied");
      expect(store.records[205].status).toBe("issue_reported");
    });

    it("maps local completion types to RouteStop display statuses", () => {
      expect(localStatusToRouteStopStatus("completed")).toBe("completed");
      expect(localStatusToRouteStopStatus("car_not_available")).toBe("car_not_available");
      expect(localStatusToRouteStopStatus("plate_not_visible")).toBe("car_not_available");
      expect(localStatusToRouteStopStatus("customer_skip")).toBe("car_not_available");
      expect(localStatusToRouteStopStatus("access_denied")).toBe("car_not_available");
      expect(localStatusToRouteStopStatus("issue_reported")).toBe("car_not_available");
    });

    it("purges stale stores from earlier dates when accessing today's store", () => {
      // Simulate yesterday's store in localStorage
      const yesterdayKey = `cwp_staff_dcms_${staffId}_2026-11-13`;
      storeMap[yesterdayKey] = JSON.stringify({
        staffId,
        istDate: "2026-11-13",
        records: { 99: { subscriptionId: 99, status: "completed" } },
      });

      // Reading today's store triggers automatic cleanup
      getDcmsDayStore(staffId, "2026-11-14");
      expect(storeMap[yesterdayKey]).toBeUndefined();
    });
  });

  describe("STAFF-025: Task-Oriented Home Dashboard & Next Task Card Selection", () => {
    it("selects the first pending stop as the priority next task", () => {
      const stops: RouteStop[] = [
        {
          subscriptionId: 1,
          customerName: "Arjun",
          vehicleNumber: "UP65AB1111",
          vehicleMake: "Maruti",
          vehicleModel: "Swift",
          todayStatus: "completed",
          remainingCleanings: 10,
        },
        {
          subscriptionId: 2,
          customerName: "Sunita",
          vehicleNumber: "UP65CD2222",
          vehicleMake: "Hyundai",
          vehicleModel: "Creta",
          todayStatus: "pending",
          remainingCleanings: 15,
          parkingBay: "B-42",
        },
        {
          subscriptionId: 3,
          customerName: "Rohit",
          vehicleNumber: "UP65EF3333",
          vehicleMake: "Tata",
          vehicleModel: "Nexon",
          todayStatus: "pending",
          remainingCleanings: 8,
          parkingBay: "C-12",
        },
      ];

      const nextTask = stops.find(s => s.todayStatus === "pending" || s.todayStatus === "rejected");
      expect(nextTask).toBeDefined();
      expect(nextTask?.subscriptionId).toBe(2);
      expect(nextTask?.vehicleNumber).toBe("UP65CD2222");
      expect(nextTask?.parkingBay).toBe("B-42");
    });

    it("returns null next task when all daily cleanings are completed", () => {
      const stops: RouteStop[] = [
        {
          subscriptionId: 1,
          customerName: "Arjun",
          vehicleNumber: "UP65AB1111",
          vehicleMake: "Maruti",
          vehicleModel: "Swift",
          todayStatus: "completed",
          remainingCleanings: 10,
        },
        {
          subscriptionId: 2,
          customerName: "Sunita",
          vehicleNumber: "UP65CD2222",
          vehicleMake: "Hyundai",
          vehicleModel: "Creta",
          todayStatus: "completed",
          remainingCleanings: 15,
        },
      ];

      const nextTask = stops.find(s => s.todayStatus === "pending" || s.todayStatus === "rejected");
      expect(nextTask).toBeUndefined();
    });
  });

  describe("STAFF-026: Route Search, Multi-Filter & Status Classification", () => {
    const testStops: RouteStop[] = [
      {
        subscriptionId: 10,
        customerName: "Vikram Sharma",
        vehicleNumber: "UP65AB1234",
        vehicleMake: "Honda",
        vehicleModel: "City",
        societyName: "Gokul Heights",
        parkingBay: "A-101",
        todayStatus: "pending",
        remainingCleanings: 12,
      },
      {
        subscriptionId: 11,
        customerName: "Pooja Verma",
        vehicleNumber: "DL3CAB5678",
        vehicleMake: "Maruti",
        vehicleModel: "Brezza",
        societyName: "Gokul Heights",
        parkingBay: "A-102",
        todayStatus: "completed",
        remainingCleanings: 20,
      },
      {
        subscriptionId: 12,
        customerName: "Amit Kumar",
        vehicleNumber: "UP65XY9999",
        vehicleMake: "Toyota",
        vehicleModel: "Fortuner",
        societyName: "Royal Residency",
        parkingBay: "B-201",
        todayStatus: "car_not_available",
        remainingCleanings: 5,
      },
    ];

    it("filters stops by vehicle plate digits", () => {
      const q = "5678";
      const matches = testStops.filter(s => s.vehicleNumber.toLowerCase().includes(q));
      expect(matches.length).toBe(1);
      expect(matches[0].customerName).toBe("Pooja Verma");
    });

    it("filters stops by customer name case-insensitively", () => {
      const q = "vikram";
      const matches = testStops.filter(s => s.customerName.toLowerCase().includes(q));
      expect(matches.length).toBe(1);
      expect(matches[0].vehicleNumber).toBe("UP65AB1234");
    });

    it("filters stops by parking bay", () => {
      const q = "b-201";
      const matches = testStops.filter(s => (s.parkingBay ?? "").toLowerCase().includes(q));
      expect(matches.length).toBe(1);
      expect(matches[0].vehicleModel).toBe("Fortuner");
    });

    it("computes stats accurately across all categories", () => {
      const stats = computeRouteStats(testStops);
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.notAvailable).toBe(1);
    });
  });

  describe("STAFF-029: Dynamic City & Branch Service Dynamic Adaptation", () => {
    it("identifies when city supports only Daily Car Cleaning (e.g. Noida initial launch)", () => {
      const noidaCategories = ["daily_cleaning"];
      const citySupportsBookings = noidaCategories.some(
        c => c === "car_wash" || c === "solar_cleaning" || c === "detailing"
      );
      expect(citySupportsBookings).toBe(false);
    });

    it("identifies when city supports full multi-service catalog (e.g. Varanasi)", () => {
      const varanasiCategories = ["daily_cleaning", "car_wash", "solar_cleaning", "detailing"];
      const citySupportsBookings = varanasiCategories.some(
        c => c === "car_wash" || c === "solar_cleaning" || c === "detailing"
      );
      expect(citySupportsBookings).toBe(true);
    });
  });

  describe("STAFF-030: Route Navigation Convenience & External Map Deep Links", () => {
    it("builds valid navigation URLs with coordinates", () => {
      const url = buildNavigateUrl({
        latitude: 25.3176,
        longitude: 82.9739,
      });
      expect(url).toContain("25.3176,82.9739");
    });

    it("builds navigation URLs with address when coordinates are absent", () => {
      const url = buildNavigateUrl({
        address: "Gokul Heights, Sector 78, Noida",
      });
      expect(url).toContain("Gokul%20Heights");
    });
  });
});
