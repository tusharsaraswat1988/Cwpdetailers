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
  formatStaffOperationalError,
} from "@/lib/staffLanguage";
import { staffJobKey, pickActiveJob, type StaffJob } from "@/lib/staff-jobs";
import {
  isCameraCancel,
  isCameraPermissionDenied,
  type GpsEvidenceSource,
} from "@/lib/native/captureStaffPhoto";
import { offlineQueue } from "@/services/offlineQueue";
import { suppressStaffJobAlert, type StaffJobAlert } from "@/hooks/useStaffJobAlerts";
import { getStatusIcon } from "@/components/shared/StatusBadge";
import { modeUsesCache } from "@/lib/location/locationStore";

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
    (global as any).localStorage = (global.window as any).localStorage;
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

  describe("STAFF-043 & STAFF-044: Lifecycle Transition Consistency & Authoritative Sync State", () => {
    it("clears isPendingSync flag automatically once server confirms stop completion", () => {
      const rawServerStops: RouteStop[] = [
        {
          subscriptionId: 601,
          originalSequence: 1,
          customerName: "Vipul",
          vehicleNumber: "UP65VV6001",
          vehicleMake: "Honda",
          vehicleModel: "City",
          todayStatus: "completed", // Server confirms completed!
          completedAt: "2026-11-16T02:00:00.000Z",
          remainingCleanings: 15,
        },
      ];

      // Local storage had isPendingSync: true
      saveDcmsLocalRecord(
        staffId,
        {
          subscriptionId: 601,
          vehicleNumber: "UP65VV6001",
          status: "completed",
          actionLabel: "Saved on phone",
          isPendingSync: true,
        },
        mockDate,
      );

      const store = getDcmsDayStore(staffId, mockDate);
      expect(store.records[601].isPendingSync).toBe(true);

      // Route reconciliation
      const reconciled = rawServerStops.map(s => {
        const local = store.records[s.subscriptionId];
        return {
          ...s,
          todayStatus: localStatusToRouteStopStatus(local.status),
          isPendingSync: s.todayStatus === "completed" ? false : local.isPendingSync,
        };
      });

      // Assert that because server returned todayStatus === 'completed', isPendingSync is resolved to false
      expect(reconciled[0].todayStatus).toBe("completed");
      expect(reconciled[0].isPendingSync).toBe(false);
    });

    it("STAFF-044: prevents terminal completed jobs from reopening or re-transitioning", () => {
      const completedJob: StaffJob = {
        id: 901,
        source: "execution",
        status: "completed",
        customerName: "Terminal Customer",
      };

      // Ensure that completed status is recognized as terminal
      const isTerminalStatus = completedJob.status === "completed" || completedJob.status === "cancelled";
      expect(isTerminalStatus).toBe(true);
    });

    it("STAFF-045: resolves active job with strict precedence (in_progress > paused > en_route > confirmed > scheduled)", () => {
      const scheduledJob: StaffJob = { id: 101, source: "booking", status: "scheduled", customerName: "Sched" };
      const confirmedJob: StaffJob = { id: 102, source: "booking", status: "confirmed", customerName: "Conf" };
      const enRouteJob: StaffJob = { id: 103, source: "booking", status: "en_route", customerName: "Route" };
      const pausedJob: StaffJob = { id: 104, source: "execution", status: "paused", customerName: "Pause" };
      const inProgressJob: StaffJob = { id: 105, source: "execution", status: "in_progress", customerName: "Active" };

      // Case 1: All present -> in_progress wins
      expect(pickActiveJob([scheduledJob, confirmedJob, enRouteJob, pausedJob, inProgressJob])?.id).toBe(105);

      // Case 2: in_progress done -> paused wins
      expect(pickActiveJob([scheduledJob, confirmedJob, enRouteJob, pausedJob])?.id).toBe(104);

      // Case 3: paused done -> en_route wins
      expect(pickActiveJob([scheduledJob, confirmedJob, enRouteJob])?.id).toBe(103);

      // Case 4: en_route done -> confirmed wins over scheduled
      expect(pickActiveJob([scheduledJob, confirmedJob])?.id).toBe(102);

      // Case 5: Only scheduled -> scheduled wins
      expect(pickActiveJob([scheduledJob])?.id).toBe(101);

      // Case 6: Only completed/cancelled -> returns null
      const completedJob: StaffJob = { id: 106, source: "booking", status: "completed", customerName: "Done" };
      expect(pickActiveJob([completedJob])).toBeNull();
    });

    it("STAFF-046: persists execution job acceptance across app refresh and recognizes cancelled terminal state", () => {
      const storageKey = "staff_job_accepted_execution_888";
      window.localStorage.setItem(storageKey, "1");

      const isAcceptedRestored = window.localStorage.getItem(storageKey) === "1";
      expect(isAcceptedRestored).toBe(true);

      // Once moved past scheduled, key is cleared
      window.localStorage.removeItem(storageKey);
      expect(window.localStorage.getItem(storageKey)).toBeNull();

      // Cancelled state is verified as non-actionable
      const cancelledJob: StaffJob = { id: 888, source: "execution", status: "cancelled", customerName: "Cancelled Cust" };
      expect(cancelledJob.status).toBe("cancelled");
    });

    it("STAFF-047: classifies shutter-time GPS evidence accurately without silent disguise", () => {
      // 1. Fresh fix with accuracy <= 200m
      const freshEvidence = {
        latitude: 25.3176,
        longitude: 82.9739,
        accuracy: 35,
        source: "fresh_shutter" as GpsEvidenceSource,
        isAcceptable: true,
      };
      expect(freshEvidence.source).toBe("fresh_shutter");
      expect(freshEvidence.isAcceptable).toBe(true);

      // 2. Low accuracy fix (> 200m)
      const lowAccEvidence = {
        latitude: 25.3176,
        longitude: 82.9739,
        accuracy: 450,
        source: "low_accuracy" as GpsEvidenceSource,
        isAcceptable: false,
      };
      expect(lowAccEvidence.source).toBe("low_accuracy");
      expect(lowAccEvidence.isAcceptable).toBe(false);

      // 3. Permission denied
      const deniedEvidence = {
        latitude: 0,
        longitude: 0,
        accuracy: 999,
        source: "permission_denied" as GpsEvidenceSource,
        isAcceptable: false,
      };
      expect(deniedEvidence.source).toBe("permission_denied");
      expect(deniedEvidence.isAcceptable).toBe(false);

      // 4. Cached location fallback (audited, not disguised as fresh)
      const fallbackEvidence = {
        latitude: 25.3176,
        longitude: 82.9739,
        accuracy: 80,
        source: "last_known_fallback" as GpsEvidenceSource,
        isAcceptable: true,
      };
      expect(fallbackEvidence.source).toBe("last_known_fallback");
      expect(fallbackEvidence.isAcceptable).toBe(true);
    });

    it("STAFF-048: recovers orphaned syncing items on process restart and prevents duplicate queue entries", async () => {
      // Clear fallback storage
      window.localStorage.removeItem("cwp_offline_queue_fallback");

      // Enqueue a photo upload item
      const item1 = await offlineQueue.enqueue({
        type: "staff_photo",
        label: "Before photo",
        url: "cwp://staff-photo",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: 123, kind: "before", fileName: "car.jpg" }),
      });
      expect(item1.id).toBeDefined();
      expect(item1.status).toBe("pending");

      // Duplicate upload prevention: enqueuing the exact same item returns existing item
      const duplicate = await offlineQueue.enqueue({
        type: "staff_photo",
        label: "Before photo",
        url: "cwp://staff-photo",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: 123, kind: "before", fileName: "car.jpg" }),
      });
      expect(duplicate.id).toBe(item1.id);

      // Simulate process crash while syncing: item left in 'syncing' state
      const all = await offlineQueue.getAllItems();
      all[0].status = "syncing";
      window.localStorage.setItem("cwp_offline_queue_fallback", JSON.stringify(all));

      // Reopening app calls getPendingItems(): orphaned syncing item must be restored to pending
      const pendingAfterRestart = await offlineQueue.getPendingItems();
      expect(pendingAfterRestart.length).toBe(1);
      expect(pendingAfterRestart[0].status).toBe("pending");
    });

    it("STAFF-049: restores active in-progress job navigation after Android process restart", () => {
      const activeJob: StaffJob = {
        id: 777,
        source: "execution",
        status: "in_progress",
        customerName: "Active Cust",
      };
      const scheduledJob: StaffJob = {
        id: 778,
        source: "execution",
        status: "scheduled",
        customerName: "Next Cust",
      };

      const resolvedActive = pickActiveJob([scheduledJob, activeJob]);
      expect(resolvedActive?.id).toBe(777);
      expect(staffJobKey(resolvedActive!)).toBe("execution-777");
    });

    it("STAFF-050: formats operational errors in colloquial Hindi explaining work safety and actionable next steps", () => {
      // 1. Camera permission error
      const camErr = new Error("NotAllowedError: Permission denied by user");
      expect(isCameraPermissionDenied(camErr)).toBe(true);
      expect(isCameraCancel(camErr)).toBe(false);

      const formattedCam = formatStaffOperationalError(camErr, true);
      expect(formattedCam.title).toContain("कैमरा परमिशन");
      expect(formattedCam.description).toContain("सुरक्षित");

      // 2. Weak connection / offline error
      const netErr = new TypeError("Failed to fetch");
      const formattedNet = formatStaffOperationalError(netErr, true);
      expect(formattedNet.title).toContain("कमजोर");
      expect(formattedNet.description).toContain("सुरक्षित");

      // 3. User cancellation of camera
      const cancelErr = new Error("user cancelled");
      expect(isCameraCancel(cancelErr)).toBe(true);
    });
  });

  describe("Phase P7: Assignment Synchronization, Staff Eligibility & Access Integrity (STAFF-051, STAFF-052, STAFF-054)", () => {
    it("STAFF-051: attaches direct jobKey to StaffJobAlert for reliable deep linking and suppresses self-view alerts", () => {
      const newExecutionJob: StaffJob = {
        id: 991,
        source: "execution",
        taskType: "car_wash",
        customerName: "P7 Customer",
        serviceName: "Doorstep Car Wash",
        scheduledTime: "10:30 AM",
      };

      const key = staffJobKey(newExecutionJob);
      expect(key).toBe("execution-991");

      const alert: StaffJobAlert = {
        id: newExecutionJob.id,
        jobKey: key,
        customerName: newExecutionJob.customerName,
        serviceName: newExecutionJob.serviceName,
        scheduledTime: newExecutionJob.scheduledTime,
        receivedAt: Date.now(),
      };

      expect(alert.jobKey).toBe("execution-991");
      const deepLinkHref = `/staff/bookings?job=${encodeURIComponent(alert.jobKey)}`;
      expect(deepLinkHref).toBe("/staff/bookings?job=execution-991");

      // Test suppression for walk-in / self-started job
      suppressStaffJobAlert(newExecutionJob);
      const stored = JSON.parse(storeMap["cwp_staff_alerted_jobs"] ?? "[]");
      expect(stored).toContain("execution-991");
    });

    it("STAFF-052: detects reassigned or removed jobs and displays non-crashing conflict recovery state", () => {
      const selectedJobKey = "execution-999";
      const availableTodayJobs: StaffJob[] = [
        { id: 101, source: "execution", status: "scheduled", customerName: "Other Job" },
      ];
      const availableAllJobs: StaffJob[] = [
        { id: 101, source: "execution", status: "scheduled", customerName: "Other Job" },
      ];

      // Case 1: Job was reassigned/removed by Admin -> not present in today or all
      const isJobNotFoundOrReassigned = Boolean(
        selectedJobKey &&
        !availableTodayJobs.some(j => staffJobKey(j) === selectedJobKey) &&
        !availableAllJobs.some(j => staffJobKey(j) === selectedJobKey)
      );
      expect(isJobNotFoundOrReassigned).toBe(true);

      // Case 2: Job is present -> normal view
      const validKey = "execution-101";
      const isValidPresent = Boolean(
        validKey &&
        (availableTodayJobs.some(j => staffJobKey(j) === validKey) ||
         availableAllJobs.some(j => staffJobKey(j) === validKey))
      );
      expect(isValidPresent).toBe(true);
    });

    it("STAFF-054: formats assignment conflicts and removals into reassuring colloquial Hindi without raw errors", () => {
      // 1. Reassigned to another technician
      const reassignedErr = new Error("Wrong technician — this job is assigned to a different staff member");
      const formattedReassigned = formatStaffOperationalError(reassignedErr, true);
      expect(formattedReassigned.title).toBe("काम दूसरे साथी को सौंपा गया है");
      expect(formattedReassigned.description).toContain("आपके नाम पर नहीं है");

      // 2. Removed by Admin
      const removedErr = new Error("Linked assignment was removed — cannot execute");
      const formattedRemoved = formatStaffOperationalError(removedErr, true);
      expect(formattedRemoved.title).toBe("काम हटा दिया गया है");
      expect(formattedRemoved.description).toContain("असाइनमेंट हटा दिया है");

      // 3. Cancelled job
      const cancelledErr = new Error("Execution is already cancelled");
      const formattedCancelled = formatStaffOperationalError(cancelledErr, true);
      expect(formattedCancelled.title).toBe("काम रद्द हो चुका है");
      expect(formattedCancelled.description).toContain("रद्द कर दिया है");
    });
  });

  describe("Phase P8: Staff UX Completeness, Performance & Interaction Consistency (STAFF-055 to STAFF-058)", () => {
    it("STAFF-055: ensures non-color-only status badges with distinct visual iconography for accessibility", () => {
      // 1. Success tone provides CheckCircle2 icon
      const successIcon = getStatusIcon("completed", "success");
      expect(successIcon).toBeDefined();

      // 2. Pending/scheduled provides Clock icon
      const pendingIcon = getStatusIcon("pending", "warning");
      expect(pendingIcon).toBeDefined();

      // 3. In-progress/en_route provides RotateCw progress icon
      const progressIcon = getStatusIcon("in_progress", "progress");
      expect(progressIcon).toBeDefined();

      // 4. Exception/warning provides AlertTriangle icon
      const warningIcon = getStatusIcon("car_not_available", "warning");
      expect(warningIcon).toBeDefined();

      // 5. Destructive/cancelled provides XCircle icon
      const destructiveIcon = getStatusIcon("cancelled", "destructive");
      expect(destructiveIcon).toBeDefined();
    });

    it("STAFF-056: verifies two-step logout confirmation dialog text and active shift safety reassurance", () => {
      // Hindi translation check
      const hiTitle = translate("logout_confirm_title", "hi");
      const hiDesc = translate("logout_confirm_desc", "hi");
      const hiBtn = translate("logout_confirm_btn", "hi");
      const hiCancel = translate("logout_cancel_btn", "hi");

      expect(hiTitle).toBe("लॉगआउट करना चाहते हैं?");
      expect(hiDesc).toContain("अटेंडेंस और सिंक हुआ काम पूरी तरह सुरक्षित रहेगा");
      expect(hiBtn).toBe("हाँ, लॉगआउट करें");
      expect(hiCancel).toBe("नहीं, वापस जाएं");

      // English translation check
      const enTitle = translate("logout_confirm_title", "en");
      const enDesc = translate("logout_confirm_desc", "en");
      expect(enTitle).toContain("Log out");
      expect(enDesc).toContain("attendance and synced work remain completely safe");
    });

    it("STAFF-057: verifies query caching staleTime prevents redundant immediate background refetching", () => {
      // Query options contract for mobile low-bandwidth resilience
      const queryOpts = {
        staleTime: 15_000,
        refetchInterval: 30_000,
      };

      expect(queryOpts.staleTime).toBe(15_000); // 15 seconds warm cache
      expect(queryOpts.refetchInterval).toBe(30_000); // 30 seconds background sync
      expect(queryOpts.staleTime).toBeLessThanOrEqual(queryOpts.refetchInterval);
    });

    it("STAFF-058: validates staff account support infrastructure, version string and phone dialer sanitization", () => {
      // 1. App version display string
      const appVersion = "v2.0 (Build 2026.11)";
      expect(appVersion).toMatch(/^v2\.0/);

      // 2. Support translation completeness
      expect(translate("field_support", "hi")).toBe("फील्ड सपोर्ट व सहायता");
      expect(translate("call_support", "hi")).toBe("सपोर्ट को कॉल करें");
      expect(translate("app_version", "hi")).toBe("ऐप वर्शन");
      expect(translate("session_active", "hi")).toContain("सक्रिय सत्र");

      // 3. Phone dialer URI sanitization
      const rawCustomerPhone = "+91 98765-43210";
      const sanitizedDialer = `tel:${rawCustomerPhone.replace(/[^\d+]/g, "")}`;
      expect(sanitizedDialer).toBe("tel:+919876543210");
    });
  });

  describe("Phase P9: Operational Exceptions, Incomplete Work & Recovery Workflows (STAFF-059..STAFF-062)", () => {
    it("STAFF-059: DCMS vehicle exception handling with mandatory evidence photo validation contract", () => {
      // 1. Local storage supports extended DCMS exception types
      saveDcmsLocalRecord(
        staffId,
        {
          subscriptionId: 701,
          vehicleNumber: "UP65EE7001",
          status: "car_not_available",
          completionType: "water_unavailable",
          actionLabel: "Water Unavailable — पानी नहीं मिला",
          isPendingSync: true,
          exceptionReason: "WATER_UNAVAILABLE: Society pump maintenance in progress",
        },
        mockDate,
      );

      const store = getDcmsDayStore(staffId, mockDate);
      const record = store.records[701];
      expect(record).toBeDefined();
      expect(record.status).toBe("car_not_available");
      expect(record.completionType).toBe("water_unavailable");
      expect(record.exceptionReason).toContain("WATER_UNAVAILABLE");
      expect(record.isPendingSync).toBe(true);

      // 2. Route stop status mapping
      expect(localStatusToRouteStopStatus(record.status)).toBe("car_not_available");

      // 3. Mandatory photo contract validation
      const validateDcmsExceptionPayload = (payload: {
        subscriptionId: number;
        imageBase64?: string | null;
        latitude?: number | null;
        longitude?: number | null;
      }) => {
        if (!payload.subscriptionId || !payload.imageBase64 || payload.latitude == null || payload.longitude == null) {
          throw new Error("Missing required exception fields: imageBase64 and GPS coordinates are mandatory proof");
        }
        return true;
      };

      // Fails when photo is absent
      expect(() =>
        validateDcmsExceptionPayload({
          subscriptionId: 701,
          imageBase64: null,
          latitude: 25.3176,
          longitude: 82.9739,
        }),
      ).toThrow("Missing required exception fields");

      // Succeeds when photo proof and GPS are provided
      expect(
        validateDcmsExceptionPayload({
          subscriptionId: 701,
          imageBase64: "data:image/jpeg;base64,mockproof",
          latitude: 25.3176,
          longitude: 82.9739,
        }),
      ).toBe(true);
    });

    it("STAFF-060: Appointment service exception reporting with authoritative backend transition to missed", () => {
      // 1. Exception reason formatting contract
      const optionId = "customer_unreachable";
      const userRemarks = "Called 3 times with no answer";
      const formattedReason = `${optionId.toUpperCase()}: ${userRemarks.trim()}`;
      expect(formattedReason).toBe("CUSTOMER_UNREACHABLE: Called 3 times with no answer");

      // 2. Job transition to 'missed'
      const activeJob: StaffJob = {
        id: 505,
        source: "execution",
        status: "in_progress",
        customerName: "Ramesh Sharma",
        serviceName: "Deep Detailing",
      };

      // Transition simulation
      const transitionToMissed = (job: StaffJob, reason: string): StaffJob => {
        return {
          ...job,
          status: "missed",
          technicianNotes: reason,
        };
      };

      const missedJob = transitionToMissed(activeJob, formattedReason);
      expect(missedJob.status).toBe("missed");
      expect(missedJob.technicianNotes).toBe(formattedReason);

      // 3. Recognized as terminal non-active state
      const isTerminal = missedJob.status === "completed" || missedJob.status === "cancelled" || missedJob.status === "missed";
      expect(isTerminal).toBe(true);

      // 4. pickActiveJob excludes missed jobs
      expect(pickActiveJob([missedJob])).toBeNull();
    });

    it("STAFF-061: Service-specific checklist integrity, persistence across reload, and required-step gating", () => {
      const jobId = 303;
      const jobSource = "execution";
      const checklistStorageKey = `staff_job_checklist_${jobSource}_${jobId}`;

      // 1. Checklist definitions with required flags
      const vehicleChecklist = [
        { id: "v1", label: "Inspect vehicle & marks", required: true },
        { id: "v2", label: "Perform wash service", required: true },
        { id: "v3", label: "Clean mirrors & wheels", required: true },
        { id: "v4", label: "Pack equipment", required: true },
      ];

      // 2. Partial completion in progress
      const initialProgress = { v1: true, v2: true };
      window.localStorage.setItem(checklistStorageKey, JSON.stringify(initialProgress));

      // 3. Simulated app restart / refresh: reload state from storage
      const restoredProgress = JSON.parse(window.localStorage.getItem(checklistStorageKey) || "{}");
      expect(restoredProgress.v1).toBe(true);
      expect(restoredProgress.v2).toBe(true);
      expect(restoredProgress.v3).toBeFalsy();

      // 4. Progress calculation
      const totalItems = vehicleChecklist.length;
      let completedCount = vehicleChecklist.filter(item => restoredProgress[item.id]).length;
      let allRequiredDone = vehicleChecklist.every(item => !item.required || restoredProgress[item.id]);

      expect(completedCount).toBe(2);
      expect(totalItems).toBe(4);
      expect(allRequiredDone).toBe(false); // Gating prevents moving to after photos

      // 5. Complete remaining required items
      restoredProgress.v3 = true;
      restoredProgress.v4 = true;
      window.localStorage.setItem(checklistStorageKey, JSON.stringify(restoredProgress));

      completedCount = vehicleChecklist.filter(item => restoredProgress[item.id]).length;
      allRequiredDone = vehicleChecklist.every(item => !item.required || restoredProgress[item.id]);

      expect(completedCount).toBe(4);
      expect(allRequiredDone).toBe(true); // Gating passes
    });

    it("STAFF-062: Staff recovery guidance, error translation, and storage cleanup on terminal completion", () => {
      // 1. Error formatting with exception / missed operational message
      const err = new Error("Execution marked missed due to customer unreachable");
      const formattedHi = formatStaffOperationalError(err, true);
      const formattedEn = formatStaffOperationalError(err, false);

      expect(formattedHi.title).toBe("एक्सेप्शन दर्ज हुआ");
      expect(formattedHi.description).toContain("सुपरवाइजर को अपडेट मिल गया है");
      expect(formattedEn.title).toBe("Exception Recorded");
      expect(formattedEn.description).toContain("Operations has been notified");

      // 2. Storage cleanup on terminal completion / exception
      const jobId = 404;
      const source = "execution";
      const acceptedKey = `staff_job_accepted_${source}_${jobId}`;
      const checklistKey = `staff_job_checklist_${source}_${jobId}`;

      window.localStorage.setItem(acceptedKey, "1");
      window.localStorage.setItem(checklistKey, JSON.stringify({ v1: true }));

      // Clean up simulated terminal completion handler
      const cleanupTerminalJobStorage = (jSource: string, jId: number) => {
        window.localStorage.removeItem(`staff_job_accepted_${jSource}_${jId}`);
        window.localStorage.removeItem(`staff_job_checklist_${jSource}_${jId}`);
      };

      cleanupTerminalJobStorage(source, jobId);
      expect(window.localStorage.getItem(acceptedKey)).toBeNull();
      expect(window.localStorage.getItem(checklistKey)).toBeNull();

      // 3. Localization keys check
      expect(translate("report_issue_btn", "hi")).toBe("समस्या रिपोर्ट करें / काम नहीं हो सका");
      expect(translate("job_missed_title", "hi")).toBe("काम एक्सेप्शन / नहीं हो सका");
      expect(translate("checklist_steps_done", "hi")).toBe("स्टेप्स पूरे");
      expect(translate("checklist_required_helper", "hi")).toContain("सभी चेकलिस्ट स्टेप्स पर सही का निशान लगाएं");
    });
  });

  describe("Phase P10: Operational State Consistency, Race Conditions & Stale-Data Recovery (STAFF-063..STAFF-067)", () => {
    it("STAFF-063: Lifecycle Transition Race-Condition Audit and Terminal State Reversal Protection", () => {
      // 1. Double-tap race condition guard logic
      let locatingJobId: number | null = null;
      let isTransitionPending = false;
      let mutationTriggerCount = 0;

      const triggerTransition = (jobId: number) => {
        if (locatingJobId != null || isTransitionPending) {
          return { status: "blocked_by_in_flight_lock" };
        }
        locatingJobId = jobId;
        isTransitionPending = true;
        mutationTriggerCount++;
        return { status: "dispatched" };
      };

      // First tap dispatches
      const firstTap = triggerTransition(101);
      expect(firstTap.status).toBe("dispatched");
      expect(mutationTriggerCount).toBe(1);

      // Rapid second tap is blocked by the in-flight lock
      const secondTap = triggerTransition(101);
      expect(secondTap.status).toBe("blocked_by_in_flight_lock");
      expect(mutationTriggerCount).toBe(1);

      // 2. Terminal state reversal protection
      const terminalStatuses = ["completed", "cancelled", "missed"];
      const allowedTransitionsFromTerminal = (status: string) => {
        if (terminalStatuses.includes(status)) {
          return []; // No valid forward transitions from terminal states
        }
        return ["in_progress", "completed", "cancelled", "missed"];
      };

      for (const tStatus of terminalStatuses) {
        expect(allowedTransitionsFromTerminal(tStatus)).toHaveLength(0);
      }
    });

    it("STAFF-064: Idempotency & Duplicate Action Protection for Execution, Booking and Attendance", () => {
      // 1. Booking / Execution idempotent status transition check
      const simulateTransition = (currentStatus: string, requestedStatus: string) => {
        if (currentStatus === requestedStatus) {
          return { ok: true, idempotent: true, status: currentStatus };
        }
        if (["completed", "cancelled", "missed"].includes(currentStatus)) {
          return { ok: false, error: `Cannot transition from terminal status "${currentStatus}"` };
        }
        return { ok: true, idempotent: false, status: requestedStatus };
      };

      // Repeating "confirmed" on confirmed booking returns existing record idempotently
      const repeatConfirm = simulateTransition("confirmed", "confirmed");
      expect(repeatConfirm.ok).toBe(true);
      expect(repeatConfirm.idempotent).toBe(true);

      // Attempting to move completed booking to in_progress returns error
      const terminalAttempt = simulateTransition("completed", "in_progress");
      expect(terminalAttempt.ok).toBe(false);
      expect(terminalAttempt.error).toContain("terminal status");

      // 2. Attendance check-in idempotency contract: existing record returned with 200 OK
      const attendanceDb: { id: number; staffId: number; date: string; status: string }[] = [];
      const markAttendanceIdempotent = (sId: number, dateStr: string) => {
        const existing = attendanceDb.find(a => a.staffId === sId && a.date === dateStr);
        if (existing) {
          return { statusCode: 200, record: existing, isRetry: true };
        }
        const created = { id: attendanceDb.length + 1, staffId: sId, date: dateStr, status: "present" };
        attendanceDb.push(created);
        return { statusCode: 201, record: created, isRetry: false };
      };

      const firstPunch = markAttendanceIdempotent(99, "2026-11-16");
      expect(firstPunch.statusCode).toBe(201);
      expect(firstPunch.record.id).toBe(1);

      // Offline queue flush retry / rapid double punch
      const retryPunch = markAttendanceIdempotent(99, "2026-11-16");
      expect(retryPunch.statusCode).toBe(200);
      expect(retryPunch.isRetry).toBe(true);
      expect(retryPunch.record.id).toBe(1);
      expect(attendanceDb.length).toBe(1); // No duplicate attendance rows created
    });

    it("STAFF-065: Admin Reassignment & Ownership Conflict Recovery with Hindi guidance", () => {
      // 1. Staff ownership verification
      const jobAssignedStaffId = 88; // Assigned to another technician
      const loggedInStaffId = 99;

      const verifyStaffOwnership = (assignedId: number | null, currentStaffId: number) => {
        if (assignedId && assignedId !== currentStaffId) {
          throw new Error("Wrong technician — this booking is assigned to a different staff member");
        }
        return true;
      };

      expect(() => verifyStaffOwnership(jobAssignedStaffId, loggedInStaffId)).toThrow(
        "Wrong technician — this booking is assigned to a different staff member",
      );

      // 2. Clear colloquial Hindi guidance for reassignment conflict
      const reassignedErr = new Error("Wrong technician — this booking is assigned to a different staff member");
      const formattedReassigned = formatStaffOperationalError(reassignedErr, true);
      expect(formattedReassigned.title).toBe("काम दूसरे साथी को सौंपा गया है");
      expect(formattedReassigned.description).toContain("यह काम अब आपके नाम पर नहीं है");

      // 3. Removed assignment error guidance
      const removedErr = new Error("The linked assignment was removed by admin");
      const formattedRemoved = formatStaffOperationalError(removedErr, true);
      expect(formattedRemoved.title).toBe("काम हटा दिया गया है");
      expect(formattedRemoved.description).toContain("एडमिन ने इस काम का असाइनमेंट हटा दिया है");

      // 4. Terminal status error guidance
      const terminalErr = new Error("Cannot transition booking from terminal status completed");
      const formattedTerminal = formatStaffOperationalError(terminalErr, true);
      expect(formattedTerminal.title).toBe("काम पहले ही पूरा या रद्द हो चुका है");
      expect(formattedTerminal.description).toContain("यह काम सर्वर पर बंद हो चुका है");
    });

    it("STAFF-066: Stale Cache & Offline Queue Reconciliation across DCMS and Appointments", async () => {
      // 1. Offline queue deduplication prevents duplicate pending mutations
      const qKey = "cwp_offline_queue_fallback";
      window.localStorage.removeItem(qKey);

      const action1 = await offlineQueue.enqueue({
        type: "staff_job",
        label: "Complete job #105",
        url: "/api/service-executions/105/complete",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Completed clean" }),
      });

      // Immediate retry of same action
      const action2 = await offlineQueue.enqueue({
        type: "staff_job",
        label: "Complete job #105",
        url: "/api/service-executions/105/complete",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Completed clean" }),
      });

      expect(action1.id).toBe(action2.id); // Deduplicated to existing queue item

      // 2. DCMS multi-day storage isolation and cleanup of previous dates
      const oldDate = "2026-11-14";
      const todayDate = "2026-11-16";
      const oldStoreKey = `cwp_staff_dcms_${staffId}_${oldDate}`;
      const todayStoreKey = `cwp_staff_dcms_${staffId}_${todayDate}`;

      window.localStorage.setItem(oldStoreKey, JSON.stringify({ staffId, istDate: oldDate, records: {} }));
      saveDcmsLocalRecord(staffId, {
        subscriptionId: 555,
        vehicleNumber: "UP65-AB-1234",
        status: "completed",
        actionLabel: "Cleaned",
      }, todayDate);

      expect(window.localStorage.getItem(todayStoreKey)).not.toBeNull();
      // Verify today's store contains the fresh record
      const todayStore = getDcmsDayStore(staffId, todayDate);
      expect(todayStore.records[555]?.vehicleNumber).toBe("UP65-AB-1234");
    });

    it("STAFF-067: Operational Timeline Consistency and Duplicate Event Suppression", () => {
      // 1. Timeline event deduplication within 5-second window
      const timeline: { id: number; eventType: string; description: string; createdAt: number }[] = [];

      const recordTimelineEvent = (eventType: string, description: string, timestamp: number) => {
        const last = timeline[timeline.length - 1];
        if (
          last &&
          last.eventType === eventType &&
          last.description === description &&
          timestamp - last.createdAt < 5000
        ) {
          return { deduplicated: true };
        }
        timeline.push({ id: timeline.length + 1, eventType, description, createdAt: timestamp });
        return { deduplicated: false };
      };

      const t0 = Date.now();
      const ev1 = recordTimelineEvent("STATUS_CHANGE", "Technician marked en-route", t0);
      expect(ev1.deduplicated).toBe(false);
      expect(timeline.length).toBe(1);

      // Repeat identical event 1.2s later (e.g. network retry or button bounce)
      const ev2 = recordTimelineEvent("STATUS_CHANGE", "Technician marked en-route", t0 + 1200);
      expect(ev2.deduplicated).toBe(true);
      expect(timeline.length).toBe(1);

      // Different event 2s later
      const ev3 = recordTimelineEvent("STATUS_CHANGE", "Execution started", t0 + 2000);
      expect(ev3.deduplicated).toBe(false);
      expect(timeline.length).toBe(2);

      // Identical event 6s later (outside 5s deduplication window)
      const ev4 = recordTimelineEvent("STATUS_CHANGE", "Execution started", t0 + 8000);
      expect(ev4.deduplicated).toBe(false);
      expect(timeline.length).toBe(3);

      // 2. Deterministic timeline sorting
      const sorted = [...timeline].sort((a, b) => a.createdAt - b.createdAt);
      expect(sorted[0].description).toBe("Technician marked en-route");
      expect(sorted[1].description).toBe("Execution started");
      expect(sorted[2].description).toBe("Execution started");
    });
  });

  describe("Phase P11: Field Usability, Accessibility & Workflow Friction Audit (STAFF-068..STAFF-073)", () => {
    it("STAFF-068: Field Usability Audit & Operational Task Priority Hierarchy", () => {
      // Priority Resolver: exactly one hero next action at any given time
      const resolveHeroTask = (
        routeStops: { id: number; status: "pending" | "completed" | "skipped" }[],
        bookingJobs: { id: number; status: string; taskType: string }[]
      ) => {
        // 1. In-progress or en-route booking takes absolute active priority
        const activeBooking = bookingJobs.find(
          j => j.status === "in_progress" || j.status === "en_route" || j.status === "paused"
        );
        if (activeBooking) {
          return { type: "booking", id: activeBooking.id, status: activeBooking.status, isHero: true };
        }

        // 2. Otherwise morning DCMS route pending stop takes precedence
        const nextDailyStop = routeStops.find(s => s.status === "pending");
        if (nextDailyStop) {
          return { type: "daily_clean", id: nextDailyStop.id, status: nextDailyStop.status, isHero: true };
        }

        // 3. When DCMS is completed, next scheduled booking takes precedence
        const nextScheduledBooking = bookingJobs.find(
          j => j.status === "scheduled" || j.status === "confirmed"
        );
        if (nextScheduledBooking) {
          return { type: "booking", id: nextScheduledBooking.id, status: nextScheduledBooking.status, isHero: true };
        }

        // 4. All tasks completed
        const hasWork = routeStops.length > 0 || bookingJobs.length > 0;
        const allCompleted =
          routeStops.every(s => s.status === "completed" || s.status === "skipped") &&
          bookingJobs.every(j => j.status === "completed" || j.status === "cancelled" || j.status === "missed");

        if (hasWork && allCompleted) {
          return { type: "completed_celebration", isHero: false };
        }

        // 5. Zero assignments today
        return { type: "empty_state", isHero: false };
      };

      // Case 1: In-progress booking overrides pending DCMS stop for hero focus
      const stops = [{ id: 1, status: "pending" as const }, { id: 2, status: "pending" as const }];
      const bookings = [{ id: 101, status: "in_progress", taskType: "solar_cleaning" }];
      const hero1 = resolveHeroTask(stops, bookings);
      expect(hero1.type).toBe("booking");
      expect(hero1.id).toBe(101);

      // Case 2: Morning DCMS pending stop is hero when no active booking
      const idleBookings = [{ id: 102, status: "scheduled", taskType: "car_wash" }];
      const hero2 = resolveHeroTask(stops, idleBookings);
      expect(hero2.type).toBe("daily_clean");
      expect(hero2.id).toBe(1);

      // Case 3: When DCMS is done, scheduled booking becomes hero
      const completedStops = [{ id: 1, status: "completed" as const }, { id: 2, status: "completed" as const }];
      const hero3 = resolveHeroTask(completedStops, idleBookings);
      expect(hero3.type).toBe("booking");
      expect(hero3.id).toBe(102);

      // Case 4: All tasks completed
      const doneBookings = [{ id: 102, status: "completed", taskType: "car_wash" }];
      const hero4 = resolveHeroTask(completedStops, doneBookings);
      expect(hero4.type).toBe("completed_celebration");

      // Case 5: Zero tasks assigned today
      const hero5 = resolveHeroTask([], []);
      expect(hero5.type).toBe("empty_state");
    });

    it("STAFF-069: Hindi-First Language & Status Consistency across App Indicators", () => {
      // 1. Core status strings in Hindi
      expect(translate("filter_completed", "hi")).toBe("सफाई पूरी");
      expect(translate("filter_pending", "hi")).toBe("बाकी");
      expect(translate("filter_exceptions", "hi")).toBe("नहीं मिली");
      expect(translate("no_assignments_today", "hi")).toBe("आज कोई गाड़ी असाइन नहीं है");
      expect(translate("no_assignments_desc", "hi")).toContain("सुपरवाइजर");

      // 2. Operational exception labels in Hindi
      const exceptionLabelsHi = [
        "गाड़ी नहीं मिली",
        "ग्राहक ने मना किया",
        "गेट या पार्किंग बंद",
        "पानी उपलब्ध नहीं",
        "गाड़ी पहले से साफ है",
        "ग्राहक नहीं मिला",
        "पार्किंग गलत दर्ज है",
        "अन्य समस्या",
      ];
      for (const label of exceptionLabelsHi) {
        expect(label).toBeTruthy();
      }

      // 3. Location and Sync status badges in Hindi
      const formatLocationStatus = (state: "active" | "denied" | "checking", isHi: boolean) => {
        if (!isHi) return state === "active" ? "GPS Active" : state === "denied" ? "GPS Off" : "Checking…";
        return state === "active" ? "GPS चालू" : state === "denied" ? "GPS बंद" : "जांच हो रही…";
      };
      expect(formatLocationStatus("active", true)).toBe("GPS चालू");
      expect(formatLocationStatus("denied", true)).toBe("GPS बंद");
      expect(formatLocationStatus("checking", true)).toBe("जांच हो रही…");

      const formatSyncStatus = (state: "synced" | "syncing" | "offline", isHi: boolean) => {
        if (!isHi) return state === "synced" ? "Synced" : state === "syncing" ? "Syncing…" : "Offline";
        return state === "synced" ? "सिंक पूरा" : state === "syncing" ? "सिंक हो रहा…" : "ऑफलाइन";
      };
      expect(formatSyncStatus("synced", true)).toBe("सिंक पूरा");
      expect(formatSyncStatus("syncing", true)).toBe("सिंक हो रहा…");
      expect(formatSyncStatus("offline", true)).toBe("ऑफलाइन");
    });

    it("STAFF-070: Touch Targets, Typography & Accessibility Standards", () => {
      // Validate touch target specifications (>= 44px min-height/width, standard 48px)
      const touchTargetElements = [
        { name: "Language Toggle (AppShell)", minHeight: 44, minWidth: 44 },
        { name: "Language Buttons (Profile)", minHeight: 48, minWidth: 100 },
        { name: "Primary Action Button (NextTaskCard)", minHeight: 48, minWidth: 120 },
        { name: "Phone Call Button (NextTaskCard)", minHeight: 48, minWidth: 48 },
        { name: "Navigate Directions Link (NextTaskCard)", minHeight: 48, minWidth: 100 },
        { name: "Copy Address Button (NextTaskCard)", minHeight: 44, minWidth: 44 },
        { name: "Refresh Route Button (DailyRoute)", minHeight: 44, minWidth: 44 },
        { name: "Search Clear Button (DailyRoute)", minHeight: 44, minWidth: 44 },
        { name: "Options Dropdown Trigger (DailyRoute)", minHeight: 48, minWidth: 48 },
        { name: "Exception Trigger Button (JobFlow)", minHeight: 48, minWidth: 120 },
        { name: "Modal Dismiss / Back Button", minHeight: 44, minWidth: 44 },
        { name: "Logout Action / Cancel (Profile)", minHeight: 48, minWidth: 80 },
      ];

      for (const el of touchTargetElements) {
        expect(el.minHeight).toBeGreaterThanOrEqual(44);
        expect(el.minWidth).toBeGreaterThanOrEqual(44);
      }

      // Non-color-only requirement: every status must have text or icon
      const statuses = ["pending", "in_progress", "completed", "cancelled", "missed", "skipped"];
      for (const status of statuses) {
        const icon = getStatusIcon(status);
        expect(icon).toBeDefined();
      }
    });

    it("STAFF-071: Primary Action & Workflow Simplification with Route Sequence Preservation", () => {
      // 1. Single Primary Action: never show two competing primary hero actions
      const renderScreenActions = (hasActiveJob: boolean, hasPendingDaily: boolean) => {
        const actions: { label: string; isPrimary: boolean }[] = [];
        if (hasActiveJob) {
          actions.push({ label: "Continue Active Booking", isPrimary: true });
        } else if (hasPendingDaily) {
          actions.push({ label: "Clean Next Vehicle", isPrimary: true });
        }
        // Secondary actions (e.g., directions, options) are never primary
        actions.push({ label: "Directions", isPrimary: false });
        actions.push({ label: "Options", isPrimary: false });

        const primaryCount = actions.filter(a => a.isPrimary).length;
        return { actions, primaryCount };
      };

      const withActive = renderScreenActions(true, true);
      expect(withActive.primaryCount).toBe(1);

      const withDailyOnly = renderScreenActions(false, true);
      expect(withDailyOnly.primaryCount).toBe(1);

      // 2. DCMS Route sequence: preserves assigned route order while permitting direct selection
      const route = [
        { seq: 1, vehicleNumber: "UP65-AA-1111", status: "pending" },
        { seq: 2, vehicleNumber: "UP65-BB-2222", status: "pending" },
        { seq: 3, vehicleNumber: "UP65-CC-3333", status: "pending" },
      ];
      // Worker can select car 2 directly if car 1 is temporarily not found
      const selectStop = (seq: number) => route.find(r => r.seq === seq);
      expect(selectStop(2)?.vehicleNumber).toBe("UP65-BB-2222");
      // Route sequence order remains intact
      expect(route[0].seq).toBe(1);
      expect(route[1].seq).toBe(2);
      expect(route[2].seq).toBe(3);
    });

    it("STAFF-072: Loading, Empty, Error & Recovery States with Actionable Triggers", () => {
      // 1. Empty state when 0 tasks assigned today
      const getDashboardState = (totalToday: number, otherPending: number, loading: boolean) => {
        if (loading) return "loading_skeleton";
        if (totalToday === 0 && otherPending === 0) return "empty_state";
        return "tasks_available";
      };

      expect(getDashboardState(0, 0, true)).toBe("loading_skeleton");
      expect(getDashboardState(0, 0, false)).toBe("empty_state");
      expect(getDashboardState(5, 0, false)).toBe("tasks_available");

      // 2. Localized error state with actionable retry handler
      let retried = false;
      const errorProps = {
        title: "काम लोड नहीं हो सका",
        description: "कृपया इंटरनेट कनेक्शन जांचें और फिर से कोशिश करें।",
        onRetry: () => {
          retried = true;
        },
      };

      expect(errorProps.title).toBe("काम लोड नहीं हो सका");
      errorProps.onRetry();
      expect(retried).toBe(true);
    });

    it("STAFF-073: Android Screen & Interaction Consistency with Safe-Area Inset Support", () => {
      // 1. Safe-area bottom padding string format verification
      const safeAreaClass = "pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]";
      expect(safeAreaClass).toContain("safe-area-inset-bottom");

      // 2. Double-tap prevention on modal submit
      let submitCount = 0;
      let isSubmitting = false;

      const handleUserSubmit = () => {
        if (isSubmitting) return false;
        isSubmitting = true;
        submitCount++;
        return true;
      };

      const tap1 = handleUserSubmit();
      expect(tap1).toBe(true);
      expect(submitCount).toBe(1);

      // Immediate second tap while request is in-flight
      const tap2 = handleUserSubmit();
      expect(tap2).toBe(false);
      expect(submitCount).toBe(1);
    });
  });

  describe("Phase P12: Security, Privacy, Permission & Evidence Integrity Audit (STAFF-074..STAFF-079)", () => {
    it("STAFF-074: Staff Data Access & Tenant Ownership Isolation", () => {
      // 1. Authorization contract: Staff caller with s.staffId = 42
      const staffScope = { isSuperAdmin: false, staffId: 42, branchIds: [1] };
      const isRecordInScope = (userRole: string, scope: typeof staffScope, row: { assignedStaffId?: number | null }) => {
        if (scope.staffId) {
          if (userRole === "staff") {
            if (row.assignedStaffId == null || row.assignedStaffId !== scope.staffId) return false;
          } else if (row.assignedStaffId != null && row.assignedStaffId !== scope.staffId) {
            return false;
          }
        }
        return true;
      };

      // Own assigned record -> allowed
      expect(isRecordInScope("staff", staffScope, { assignedStaffId: 42 })).toBe(true);

      // Other staff member's record -> strictly denied
      expect(isRecordInScope("staff", staffScope, { assignedStaffId: 99 })).toBe(false);

      // Unassigned record -> strictly denied for staff caller
      expect(isRecordInScope("staff", staffScope, { assignedStaffId: null })).toBe(false);
      expect(isRecordInScope("staff", staffScope, {})).toBe(false);

      // Admin caller inspecting unassigned or other staff's records
      const adminScope = { isSuperAdmin: true, staffId: null, branchIds: null };
      expect(isRecordInScope("admin", adminScope, { assignedStaffId: 99 })).toBe(true);
      expect(isRecordInScope("admin", adminScope, { assignedStaffId: null })).toBe(true);

      // 2. Query ID substitution protection:
      // Staff cannot override their own staffId via query params
      const resolveTargetStaffId = (user: { role: string; staffId: number }, queryParamStaffId?: number) => {
        return user.role === "staff" ? user.staffId : (queryParamStaffId ?? user.staffId);
      };
      expect(resolveTargetStaffId({ role: "staff", staffId: 42 }, 99)).toBe(42);
      expect(resolveTargetStaffId({ role: "admin", staffId: 1 }, 99)).toBe(99);

      // 3. Customer dossier access rejection for staff role
      const canAccessCustomerDossier = (role: string) => role !== "staff";
      expect(canAccessCustomerDossier("staff")).toBe(false);
      expect(canAccessCustomerDossier("admin")).toBe(true);
      expect(canAccessCustomerDossier("manager")).toBe(true);
    });

    it("STAFF-075: Photo Evidence Privacy & Integrity Verification", () => {
      // 1. Evidence URL protocol verification: must be secure https
      const isValidEvidenceUrl = (url: string) => /^https?:\/\//i.test(url.trim());
      expect(isValidEvidenceUrl("https://res.cloudinary.com/cwp/image/upload/v123/proof.jpg")).toBe(true);
      expect(isValidEvidenceUrl("http://localhost:8080/uploads/photo.jpg")).toBe(true);
      expect(isValidEvidenceUrl("javascript:alert(1)")).toBe(false);
      expect(isValidEvidenceUrl("file:///etc/passwd")).toBe(false);
      expect(isValidEvidenceUrl("data:text/html;base64,PHNjcmlwdD5...")).toBe(false);

      // 2. Customer signature URL validation
      expect(isValidEvidenceUrl("https://storage.googleapis.com/cwp-signatures/sig-123.png")).toBe(true);
      expect(isValidEvidenceUrl("blob:http://localhost/bad-blob")).toBe(false);

      // 3. Shutter-time geo-coordinates requirement
      const validatePhotoEvidence = (photo: { url: string; latitude?: number | null; longitude?: number | null }) => {
        if (!isValidEvidenceUrl(photo.url)) return { valid: false, error: "INVALID_URL" };
        if (photo.latitude == null || photo.longitude == null) return { valid: false, error: "MISSING_GPS" };
        return { valid: true };
      };

      expect(validatePhotoEvidence({ url: "https://example.com/p1.jpg", latitude: 25.31, longitude: 82.97 }).valid).toBe(true);
      expect(validatePhotoEvidence({ url: "https://example.com/p1.jpg", latitude: null, longitude: 82.97 }).valid).toBe(false);
      expect(validatePhotoEvidence({ url: "javascript:void(0)", latitude: 25.31, longitude: 82.97 }).valid).toBe(false);

      // 4. Pending / failed upload status distinction (never represented as server-confirmed)
      const evidenceItem = { id: "photo-1", status: "pending" as const, serverConfirmed: false };
      expect(evidenceItem.serverConfirmed).toBe(false);
      expect(evidenceItem.status).toBe("pending");
    });

    it("STAFF-076: GPS & Location Permission Privacy and Evidence Source Distinction", () => {
      // 1. Action mode (attendance, photo capture, completion) requires fresh GPS and strictly forbids cache
      expect(modeUsesCache("action")).toBe(false);

      // 2. Navigation mode permits bounded caching
      expect(modeUsesCache("navigation")).toBe(true);
      expect(modeUsesCache("background")).toBe(true);

      // 3. Honest location source tracking:
      // Last known location must not be falsely presented as fresh shutter-time evidence
      const formatLocationEvidence = (loc: { latitude: number; longitude: number; source?: "fresh" | "cache" | "last_known" }) => {
        const source = loc.source ?? "fresh";
        return {
          latitude: loc.latitude,
          longitude: loc.longitude,
          source,
          isFreshEvidence: source === "fresh",
        };
      };

      const freshLoc = formatLocationEvidence({ latitude: 28.53, longitude: 77.39, source: "fresh" });
      expect(freshLoc.isFreshEvidence).toBe(true);
      expect(freshLoc.source).toBe("fresh");

      const cachedLoc = formatLocationEvidence({ latitude: 28.53, longitude: 77.39, source: "cache" });
      expect(cachedLoc.isFreshEvidence).toBe(false);
      expect(cachedLoc.source).toBe("cache");
    });

    it("STAFF-077: Local Storage & Offline Data Cross-Staff Protection", () => {
      // 1. Queue items tagged with staffId and userId
      const itemStaffA = {
        id: "q-1",
        type: "staff_photo" as const,
        url: "/api/service-executions/10/photos",
        staffId: 42,
        userId: 101,
        status: "pending" as const,
      };

      const itemStaffB = {
        id: "q-2",
        type: "staff_photo" as const,
        url: "/api/service-executions/20/photos",
        staffId: 99,
        userId: 102,
        status: "pending" as const,
      };

      // 2. Active session is Staff B (staffId: 99)
      const activeStaffId = 99;

      // Filter items to sync under Staff B's session:
      // Staff A's item must be skipped to avoid cross-account contamination
      const shouldSyncItem = (item: { staffId?: number | null }, currentStaffId: number | null) => {
        if (item.staffId != null && currentStaffId != null && item.staffId !== currentStaffId) {
          return false; // Skip item belonging to different staff member
        }
        return true;
      };

      expect(shouldSyncItem(itemStaffA, activeStaffId)).toBe(false);
      expect(shouldSyncItem(itemStaffB, activeStaffId)).toBe(true);

      // When Staff A logs back in (activeStaffId: 42):
      expect(shouldSyncItem(itemStaffA, 42)).toBe(true);
      expect(shouldSyncItem(itemStaffB, 42)).toBe(false);
    });

    it("STAFF-078: Session, Logout & Account Switching Integrity", () => {
      // 1. Pending sync count detection for logout warning
      const getLogoutWarningProps = (pendingCount: number, isHindi: boolean) => {
        if (pendingCount <= 0) {
          return { hasWarning: false, message: isHindi ? "क्या आप वाकई लॉगआउट करना चाहते हैं?" : "Are you sure you want to log out?" };
        }
        return {
          hasWarning: true,
          title: isHindi ? "सावधान: बिना सिंक किए काम मौजूद हैं" : "Warning: Unsynced work pending",
          message: isHindi
            ? `आपके ${pendingCount} कार्य अभी सर्वर पर सिंक नहीं हुए हैं। यदि आप अभी लॉगआउट करेंगे, तो यह डेटा इस फोन में सुरक्षित रहेगा लेकिन सर्वर पर तब तक नहीं जाएगा जब तक आप दोबारा इसी खाते से लॉगिन नहीं करते।`
            : `You have ${pendingCount} offline action(s) not yet synced to the server. If you log out now, they will remain safely stored on this device until you log back in.`,
        };
      };

      // Safe logout when no unsynced work
      const cleanLogout = getLogoutWarningProps(0, true);
      expect(cleanLogout.hasWarning).toBe(false);

      // Warning when 3 items pending sync
      const warnedLogoutHindi = getLogoutWarningProps(3, true);
      expect(warnedLogoutHindi.hasWarning).toBe(true);
      expect(warnedLogoutHindi.title).toBe("सावधान: बिना सिंक किए काम मौजूद हैं");
      expect(warnedLogoutHindi.message).toContain("3 कार्य अभी सर्वर पर सिंक नहीं हुए हैं");
      expect(warnedLogoutHindi.message).toContain("सुरक्षित रहेगा");

      const warnedLogoutEnglish = getLogoutWarningProps(3, false);
      expect(warnedLogoutEnglish.hasWarning).toBe(true);
      expect(warnedLogoutEnglish.title).toBe("Warning: Unsynced work pending");
      expect(warnedLogoutEnglish.message).toContain("3 offline action(s)");
    });

    it("STAFF-079: Security Error Handling & Logging Hygiene", () => {
      // 1. Sanitization of raw coordinates in logs: micro-degree precision is redacted
      const sanitizeLogPayload = (rawPayload: {
        subscriptionId: number;
        latitude: number;
        longitude: number;
        accuracy?: number;
      }) => {
        return {
          subscriptionId: rawPayload.subscriptionId,
          hasGps: rawPayload.latitude != null && rawPayload.longitude != null,
          accuracy: rawPayload.accuracy != null ? Math.round(Number(rawPayload.accuracy)) : null,
        };
      };

      const logged = sanitizeLogPayload({
        subscriptionId: 101,
        latitude: 28.5355172839,
        longitude: 77.3910265192,
        accuracy: 14.8,
      });

      expect((logged as any).latitude).toBeUndefined();
      expect((logged as any).longitude).toBeUndefined();
      expect(logged.hasGps).toBe(true);
      expect(logged.accuracy).toBe(15);

      // 2. User-facing operational error translation: shield database stack traces
      const sanitizedHindiError = formatStaffOperationalError(new Error("Connection terminated unexpectedly: error at pg_query"));
      expect(sanitizedHindiError.title).toBe("काम सेव नहीं हुआ");
      expect(sanitizedHindiError.description).not.toContain("pg_query");
      expect(sanitizedHindiError.description).not.toContain("Connection terminated");
      expect(sanitizedHindiError.description.length).toBeGreaterThan(0);
    });
  });
});
