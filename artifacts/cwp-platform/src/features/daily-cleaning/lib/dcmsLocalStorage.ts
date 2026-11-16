/**
 * CWP Detailers — Daily Car Cleaning Local Storage & Field Resilience Service
 *
 * BUSINESS RULE (AGENTS.md & PRD):
 * Daily Cleaning completion data is maintained locally in localStorage for field resilience,
 * resets daily using Asia/Kolkata timezone (IST), and does not silently mutate backend schemas.
 *
 * This module manages:
 * - Local optimistic completion state for daily route stops.
 * - Key format: `cwp_staff_dcms_${staffId}_${istDate}`.
 * - Automatic purge of previous days' cache to prevent memory accumulation.
 * - Multi-exception reason tracking (car not available, plate not visible, customer skip, access denied, issue reported).
 * - Preservation of both assigned sequence and actual completion order (Phase 2 & Phase 3).
 */

export type DcmsLocalCompletionType =
  | "completed"
  | "car_not_available"
  | "plate_not_visible"
  | "customer_skip"
  | "access_denied"
  | "issue_reported";

export type DcmsLocalRecord = {
  subscriptionId: number;
  vehicleNumber: string;
  status: DcmsLocalCompletionType;
  actionLabel: string;
  timestamp: string; // ISO string
  completionOrder?: number; // Actual completion order (1st, 2nd, 3rd, ...)
  completedAtTime?: string; // Formatted IST time (e.g. 06:45 AM)
  notes?: string;
  photoDataUrl?: string; // small thumbnail or reference if stored locally
};

export type DcmsStaffDayStore = {
  staffId: number;
  istDate: string; // YYYY-MM-DD
  records: Record<number, DcmsLocalRecord>; // subscriptionId -> record
  lastUpdated: string;
};

/** Get today's calendar date in Asia/Kolkata timezone (YYYY-MM-DD) */
export function getTodayIstDate(now: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now);
  } catch {
    // Fallback if Intl timeZone is unavailable
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    return ist.toISOString().split("T")[0];
  }
}

/** Format current time in Asia/Kolkata timezone for display (e.g. "06:30 AM") */
export function formatIstTime(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(now);
  } catch {
    return now.toTimeString().slice(0, 5);
  }
}

function getStorageKey(staffId: number, istDate: string): string {
  return `cwp_staff_dcms_${staffId}_${istDate}`;
}

/** Read today's store for a staff member from localStorage */
export function getDcmsDayStore(staffId: number, istDate: string = getTodayIstDate()): DcmsStaffDayStore {
  if (typeof window === "undefined" || !window.localStorage) {
    return { staffId, istDate, records: {}, lastUpdated: new Date().toISOString() };
  }

  try {
    // Periodic housekeeping: purge previous days' keys for this staff member
    cleanupOldDcmsStores(staffId, istDate);

    const key = getStorageKey(staffId, istDate);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return { staffId, istDate, records: {}, lastUpdated: new Date().toISOString() };
    }

    const parsed = JSON.parse(raw) as DcmsStaffDayStore;
    if (parsed.staffId === staffId && parsed.istDate === istDate && typeof parsed.records === "object") {
      return parsed;
    }
    return { staffId, istDate, records: {}, lastUpdated: new Date().toISOString() };
  } catch (err) {
    console.warn("Failed to read dcms local store:", err);
    return { staffId, istDate, records: {}, lastUpdated: new Date().toISOString() };
  }
}

/** Record or update a completion or exception locally */
export function saveDcmsLocalRecord(
  staffId: number,
  record: {
    subscriptionId: number;
    vehicleNumber: string;
    status: DcmsLocalCompletionType;
    actionLabel: string;
    notes?: string;
  },
  istDate: string = getTodayIstDate(),
): DcmsStaffDayStore {
  const store = getDcmsDayStore(staffId, istDate);

  // Compute next completion order if marked completed
  const existingRecords = Object.values(store.records);
  const priorCompleted = existingRecords.filter(r => r.status === "completed" && r.subscriptionId !== record.subscriptionId);
  const currentCompletionOrder = record.status === "completed"
    ? (store.records[record.subscriptionId]?.completionOrder ?? priorCompleted.length + 1)
    : undefined;

  store.records[record.subscriptionId] = {
    subscriptionId: record.subscriptionId,
    vehicleNumber: record.vehicleNumber,
    status: record.status,
    actionLabel: record.actionLabel,
    notes: record.notes,
    timestamp: new Date().toISOString(),
    completionOrder: currentCompletionOrder,
    completedAtTime: formatIstTime(new Date()),
  };
  store.lastUpdated = new Date().toISOString();

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const key = getStorageKey(staffId, istDate);
      window.localStorage.setItem(key, JSON.stringify(store));
    } catch (err) {
      console.warn("Failed to persist dcms local record:", err);
    }
  }

  return store;
}

/** Clear all local records for the staff member for today (e.g. manual reset) */
export function clearDcmsDayStore(staffId: number, istDate: string = getTodayIstDate()): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(getStorageKey(staffId, istDate));
    } catch {
      // ignore
    }
  }
}

/** Map local status to RouteStop todayStatus */
export function localStatusToRouteStopStatus(
  status: DcmsLocalCompletionType,
): "completed" | "car_not_available" | "rejected" {
  if (status === "completed") return "completed";
  return "car_not_available";
}

/** Clean up old days' stores to prevent localStorage memory leakage */
function cleanupOldDcmsStores(staffId: number, currentIstDate: string): void {
  try {
    const prefix = `cwp_staff_dcms_${staffId}_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix) && key !== getStorageKey(staffId, currentIstDate)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage quota errors during cleanup
  }
}
