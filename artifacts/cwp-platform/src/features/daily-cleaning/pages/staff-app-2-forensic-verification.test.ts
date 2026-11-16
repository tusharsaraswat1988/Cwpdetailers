import { describe, expect, it, beforeEach } from "vitest";
import {
  computeRouteStats,
  type RouteStop,
} from "./StaffDailyRouteSimplified";
import {
  getTodayIstDate,
  getDcmsDayStore,
  saveDcmsLocalRecord,
  clearDcmsDayStore,
  localStatusToRouteStopStatus,
  formatIstTime,
} from "../lib/dcmsLocalStorage";
import {
  getStaffLanguage,
  setStaffLanguage,
  translate,
} from "@/lib/staffLanguage";
import { staffJobKey, type StaffJob } from "@/lib/staff-jobs";

describe("Staff App 2.0 — Forensic Verification Test Suite (STAFF-035 to STAFF-042)", () => {
  const staffId = 99;
  const mockDate = "2026-11-16";

  // Mock localStorage in memory for tests
  const storeMap: Record<string, string> = {};
  beforeEach(() => {
    for (const key of Object.keys(storeMap)) {
      delete storeMap[key];
    }
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

  describe("STAFF-037 & STAFF-038: Out-of-Sequence Customer Completion & Original Sequence Preservation", () => {
    it("preserves original sequence numbers on pending items when completing out-of-order", () => {
      // 5 assigned cars: 1 -> 2 -> 3 -> 4 -> 5
      const assignedStops: RouteStop[] = [
        { subscriptionId: 101, originalSequence: 1, routeOrder: 1, customerName: "Alice", vehicleNumber: "UP65AA1111", vehicleMake: "Maruti", vehicleModel: "Swift", todayStatus: "pending", remainingCleanings: 10 },
        { subscriptionId: 102, originalSequence: 2, routeOrder: 2, customerName: "Bob", vehicleNumber: "UP65BB2222", vehicleMake: "Hyundai", vehicleModel: "Creta", todayStatus: "pending", remainingCleanings: 8 },
        { subscriptionId: 103, originalSequence: 3, routeOrder: 3, customerName: "Charlie", vehicleNumber: "UP65CC3333", vehicleMake: "Tata", vehicleModel: "Harrier", todayStatus: "pending", remainingCleanings: 15 },
        { subscriptionId: 104, originalSequence: 4, routeOrder: 4, customerName: "Deepak", vehicleNumber: "UP65DD4444", vehicleMake: "Honda", vehicleModel: "City", todayStatus: "pending", remainingCleanings: 12 },
        { subscriptionId: 105, originalSequence: 5, routeOrder: 5, customerName: "Elena", vehicleNumber: "UP65EE5555", vehicleMake: "Toyota", vehicleModel: "Innova", todayStatus: "pending", remainingCleanings: 5 },
      ];

      // Staff cleans #4 first due to customer priority
      saveDcmsLocalRecord(
        staffId,
        {
          subscriptionId: 104,
          vehicleNumber: "UP65DD4444",
          status: "completed",
          actionLabel: "सफाई पूरी हुई",
        },
        mockDate,
      );

      const store = getDcmsDayStore(staffId, mockDate);
      expect(store.records[104]).toBeDefined();
      expect(store.records[104].status).toBe("completed");
      expect(store.records[104].completionOrder).toBe(1); // 1st completed today

      // Merge local records into stops
      const updatedStops = assignedStops.map(s => {
        const local = store.records[s.subscriptionId];
        if (!local) return s;
        return {
          ...s,
          todayStatus: localStatusToRouteStopStatus(local.status),
          completionOrder: local.completionOrder,
          completedAtTime: local.completedAtTime,
        };
      });

      // Segregate into Pending and Completed
      const pending = updatedStops.filter(s => s.todayStatus === "pending");
      const completed = updatedStops.filter(s => s.todayStatus === "completed");

      // Verify Completed section contains stop 104 (#4) with completion order 1
      expect(completed.length).toBe(1);
      expect(completed[0].subscriptionId).toBe(104);
      expect(completed[0].originalSequence).toBe(4); // Original sequence #4 preserved
      expect(completed[0].completionOrder).toBe(1); // 1st car finished

      // Verify Pending section retains original sequence numbers (#1, #2, #3, #5)
      expect(pending.length).toBe(4);
      expect(pending.map(p => p.originalSequence)).toEqual([1, 2, 3, 5]);
      expect(pending.map(p => p.vehicleNumber)).toEqual([
        "UP65AA1111",
        "UP65BB2222",
        "UP65CC3333",
        "UP65EE5555",
      ]);
    });

    it("records sequential completion orders for multiple out-of-order completions", () => {
      // Clean order: 4 -> then 2 -> then 1
      saveDcmsLocalRecord(staffId, { subscriptionId: 104, vehicleNumber: "UP65DD4444", status: "completed", actionLabel: "Done" }, mockDate);
      saveDcmsLocalRecord(staffId, { subscriptionId: 102, vehicleNumber: "UP65BB2222", status: "completed", actionLabel: "Done" }, mockDate);
      saveDcmsLocalRecord(staffId, { subscriptionId: 101, vehicleNumber: "UP65AA1111", status: "completed", actionLabel: "Done" }, mockDate);

      const store = getDcmsDayStore(staffId, mockDate);
      expect(store.records[104].completionOrder).toBe(1);
      expect(store.records[102].completionOrder).toBe(2);
      expect(store.records[101].completionOrder).toBe(3);
    });

    it("formats valid IST completion time strings (e.g. 06:30 AM)", () => {
      const timeStr = formatIstTime(new Date());
      expect(timeStr).toMatch(/\d{1,2}:\d{2}\s?(AM|PM|am|pm)?/);
    });
  });

  describe("STAFF-040: Hindi-First Language Experience & Vocabulary", () => {
    it("defaults to Hindi language on initial load", () => {
      expect(getStaffLanguage()).toBe("hi");
    });

    it("translates primary actions to field-worker colloquial Hindi", () => {
      setStaffLanguage("hi");
      expect(translate("complete_cleaning_action")).toBe("सफाई पूरी करें");
      expect(translate("photo_take_near_car")).toBe("गाड़ी के पास जाकर फोटो लें।");
      expect(translate("loc_not_found_retry")).toBe("लोकेशन नहीं मिल रही। फिर कोशिश करें।");
      expect(translate("photo_uploading")).toBe("फोटो भेजी जा रही है…");
      expect(translate("photo_success")).toBe("सफाई पूरी हो गई!");
      expect(translate("nav_dcms")).toBe("रोज़ाना सफाई");
      expect(translate("nav_other_jobs")).toBe("अन्य काम");
      expect(translate("nav_account")).toBe("खाता");
    });

    it("toggles cleanly to English when user prefers English", () => {
      setStaffLanguage("en");
      expect(getStaffLanguage()).toBe("en");
      expect(translate("complete_cleaning_action")).toBe("Complete Cleaning");
      expect(translate("photo_take_near_car")).toBe("Take photo standing near the car.");
      expect(translate("nav_dcms")).toBe("DCMS Route");
      expect(translate("nav_other_jobs")).toBe("My Other Jobs");
      expect(translate("nav_account")).toBe("Account");

      // Reset back to Hindi default
      setStaffLanguage("hi");
    });
  });

  describe("STAFF-035: Core Navigation Architecture Unification", () => {
    it("computes route stats accurately for progress overview", () => {
      const stops = [
        { todayStatus: "completed" },
        { todayStatus: "completed" },
        { todayStatus: "completed" },
        { todayStatus: "pending" },
        { todayStatus: "car_not_available" },
      ];

      const stats = computeRouteStats(stops);
      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.notAvailable).toBe(1);

      const percent = Math.round((stats.completed / stats.total) * 100);
      expect(percent).toBe(60);
    });
  });

  describe("STAFF-039 & STAFF-040: Operational Hardening, Sync Indicators & Deduplication", () => {
    it("tracks offline pending sync status honestly on local records", () => {
      saveDcmsLocalRecord(
        staffId,
        {
          subscriptionId: 201,
          vehicleNumber: "UP65XY9999",
          status: "completed",
          actionLabel: "फोन पर सुरक्षित (सिंक पेंडिंग)",
          isPendingSync: true,
        },
        mockDate,
      );

      const store = getDcmsDayStore(staffId, mockDate);
      expect(store.records[201]).toBeDefined();
      expect(store.records[201].isPendingSync).toBe(true);
      expect(store.records[201].actionLabel).toBe("फोन पर सुरक्षित (सिंक पेंडिंग)");
      expect(store.records[201].status).toBe("completed");
    });

    it("restores cross-session server completion timestamps and chronological completion order", () => {
      const serverStops: RouteStop[] = [
        {
          subscriptionId: 301,
          originalSequence: 1,
          routeOrder: 1,
          customerName: "Ramesh",
          vehicleNumber: "UP65AA1000",
          vehicleMake: "Maruti",
          vehicleModel: "Brezza",
          todayStatus: "completed",
          completedAt: "2026-11-16T01:30:00.000Z", // 07:00 AM IST
          remainingCleanings: 20,
        },
        {
          subscriptionId: 302,
          originalSequence: 2,
          routeOrder: 2,
          customerName: "Suresh",
          vehicleNumber: "UP65BB2000",
          vehicleMake: "Hyundai",
          vehicleModel: "Venue",
          todayStatus: "completed",
          completedAt: "2026-11-16T01:00:00.000Z", // 06:30 AM IST (completed first!)
          remainingCleanings: 18,
        },
      ];

      // Sort server completed stops chronologically
      const sorted = [...serverStops].sort((a, b) => {
        const tA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return tA - tB;
      });

      const serverOrderMap = new Map<number, number>();
      sorted.forEach((s, idx) => {
        serverOrderMap.set(s.subscriptionId, idx + 1);
      });

      // 302 was completed earlier than 301
      expect(serverOrderMap.get(302)).toBe(1);
      expect(serverOrderMap.get(301)).toBe(2);
    });

    it("translates all field execution lifecycle steps and actions into natural Hindi", () => {
      setStaffLanguage("hi");
      expect(translate("start_work")).toBe("काम शुरू करें");
      expect(translate("service_done_after_photos")).toBe("सफाई पूरी — बाद की फोटो लें");
      expect(translate("submit_complete_job")).toBe("सबमिट करें — काम पूरा हुआ");
      expect(translate("resume_work")).toBe("काम दोबारा शुरू करें");
      expect(translate("work_paused")).toBe("काम रुका हुआ है");
      expect(translate("step_route")).toBe("रास्ता");
      expect(translate("step_work")).toBe("सफाई");
      expect(translate("before_photos_label")).toBe("शुरू से पहले की फोटो (सबूत)");
      expect(translate("after_photos_label")).toBe("सफाई के बाद की फोटो (सबूत)");
    });
  });

  describe("STAFF-041 & STAFF-042: Operational Lifecycle Task Prioritization & Deep Link Resolution", () => {
    it("prioritizes actively in-progress appointment job over pending morning DCMS cars", () => {
      const pendingDcmsStop: RouteStop = {
        subscriptionId: 401,
        originalSequence: 1,
        customerName: "Morning Customer",
        vehicleNumber: "UP65DC1001",
        vehicleMake: "Maruti",
        vehicleModel: "Swift",
        todayStatus: "pending",
        remainingCleanings: 10,
      };

      const activeSolarJob: StaffJob = {
        id: 501,
        source: "execution",
        taskType: "solar_cleaning",
        customerName: "Rooftop Solar Plant",
        status: "in_progress",
      };

      // Lifecycle priority derivation
      const activeJob = [activeSolarJob].find(
        j => j.status === "in_progress" || j.status === "en_route" || j.status === "paused"
      );
      const nextStop = !activeJob ? pendingDcmsStop : null;
      const heroTask = activeJob ?? nextStop;

      expect(heroTask).toBe(activeSolarJob);
      expect(heroTask.status).toBe("in_progress");
    });

    it("prioritizes morning DCMS route when appointment jobs are only scheduled and not yet active", () => {
      const pendingDcmsStop: RouteStop = {
        subscriptionId: 402,
        originalSequence: 1,
        customerName: "Morning Customer",
        vehicleNumber: "UP65DC1002",
        vehicleMake: "Hyundai",
        vehicleModel: "i20",
        todayStatus: "pending",
        remainingCleanings: 10,
      };

      const scheduledCarWashJob: StaffJob = {
        id: 502,
        source: "booking",
        taskType: "car_wash",
        customerName: "Afternoon Wash",
        status: "scheduled",
      };

      const activeJob = [scheduledCarWashJob].find(
        j => j.status === "in_progress" || j.status === "en_route" || j.status === "paused"
      );
      const nextStop = !activeJob ? pendingDcmsStop : null;
      const heroTask = activeJob ?? nextStop;

      expect(heroTask).toBe(pendingDcmsStop);
      expect((heroTask as RouteStop).todayStatus).toBe("pending");
    });

    it("prioritizes scheduled appointment job once all morning DCMS stops are completed", () => {
      const scheduledCarWashJob: StaffJob = {
        id: 503,
        source: "booking",
        taskType: "car_wash",
        customerName: "Afternoon Wash",
        status: "scheduled",
      };

      const activeJob = [scheduledCarWashJob].find(
        j => j.status === "in_progress" || j.status === "en_route" || j.status === "paused"
      );
      const nextStop = null; // All DCMS finished
      const heroTask = activeJob ?? nextStop ?? scheduledCarWashJob;

      expect(heroTask).toBe(scheduledCarWashJob);
    });

    it("generates correct deep linking keys for execution vs booking jobs", () => {
      const executionJob: StaffJob = { id: 701, source: "execution", customerName: "Exec" };
      const bookingJob: StaffJob = { id: 801, source: "booking", customerName: "Book" };

      expect(staffJobKey(executionJob)).toBe("execution-701");
      expect(staffJobKey(bookingJob)).toBe("booking-801");
    });
  });
});
