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

  store.records[record.subscriptionId] = {
    subscriptionId: record.subscriptionId,
    vehicleNumber: record.vehicleNumber,
    status: record.status,
    actionLabel: record.actionLabel,
    notes: record.notes,
    timestamp: new Date().toISOString(),
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

/** Purge keys from older dates to conserve localStorage quota */
function cleanupOldDcmsStores(staffId: number, todayIstDate: string): void {
  try {
    const prefix = `cwp_staff_dcms_${staffId}_`;
    const toRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix) && k !== `${prefix}${todayIstDate}`) {
        toRemove.push(k);
      }
    }

    for (const k of toRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage iteration errors
  }
}

/**
 * Maps a structured local status to standard RouteStop display status:
 * - "completed" -> "completed"
 * - any exception -> "car_not_available" (keeps visit counter intact)
 */
export function localStatusToRouteStopStatus(
  status: DcmsLocalCompletionType,
): "completed" | "car_not_available" | "pending" {
  if (status === "completed") return "completed";
  return "car_not_available";
}
