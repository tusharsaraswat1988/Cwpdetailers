import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { vibrateStaffJobAlert } from "@/lib/staff-vibration";
import { staffJobKey, type StaffJob } from "@/lib/staff-jobs";

export type StaffJobAlert = {
  id: number;
  customerName?: string;
  serviceName?: string | null;
  scheduledTime?: string | null;
  receivedAt: number;
};

const ALERTED_STORAGE_KEY = "cwp_staff_alerted_jobs";

function getPersistedAlertedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(ALERTED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistAlertedKeys(keys: Set<string>) {
  try {
    // Keep max 200 keys to avoid unlimited growth
    const arr = Array.from(keys).slice(-200);
    localStorage.setItem(ALERTED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/** Walk-in / self-start: do not vibrate or show "New job assigned" for this booking. */
const suppressedAlertKeys = new Set<string>();

export function suppressStaffJobAlert(job: Pick<StaffJob, "id" | "source">) {
  const key = staffJobKey(job);
  suppressedAlertKeys.add(key);
  const persisted = getPersistedAlertedKeys();
  persisted.add(key);
  persistAlertedKeys(persisted);
}

function jobLabel(job: StaffJob) {
  const service = job.serviceName ?? job.serviceType?.replace(/_/g, " ") ?? "Job";
  return `${service}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}`;
}

function jobsSnapshotKey(jobs: StaffJob[]) {
  return jobs
    .map(j => `${staffJobKey(j)}:${j.status ?? ""}`)
    .sort()
    .join("|");
}

/**
 * Watches today's job list for newly assigned work.
 * Vibrates + returns alert state for in-app popup banner.
 * Uses persistent storage so reopening the app never re-alerts for existing/completed jobs.
 */
export function useStaffJobAlerts(todayJobs: StaffJob[], enabled: boolean) {
  const { toast } = useToast();
  const initializedRef = useRef(false);
  const [latestAlert, setLatestAlert] = useState<StaffJobAlert | null>(null);

  const dismissAlert = useCallback(() => setLatestAlert(null), []);

  const jobsKey = useMemo(() => jobsSnapshotKey(todayJobs), [todayJobs]);

  useEffect(() => {
    if (!enabled) return;

    const persisted = getPersistedAlertedKeys();

    // First time non-empty jobs load: seed all existing jobs as already known so reopening the app doesn't trigger false alerts
    if (!initializedRef.current) {
      if (todayJobs.length > 0) {
        for (const job of todayJobs) {
          persisted.add(staffJobKey(job));
        }
        persistAlertedKeys(persisted);
        initializedRef.current = true;
      }
      return;
    }

    const newJobs = todayJobs.filter(j => {
      const key = staffJobKey(j);
      if (j.status === "completed" || j.status === "cancelled") {
        persisted.add(key);
        return false;
      }
      if (suppressedAlertKeys.has(key)) {
        suppressedAlertKeys.delete(key);
        persisted.add(key);
        return false;
      }
      if (persisted.has(key)) return false;
      return true;
    });

    if (newJobs.length === 0) return;

    for (const job of newJobs) {
      persisted.add(staffJobKey(job));
    }
    persistAlertedKeys(persisted);

    vibrateStaffJobAlert();

    // Single unified alert banner to prevent conflicting double-color UI
    const first = newJobs[0]!;
    setLatestAlert({
      id: first.id,
      customerName: first.customerName,
      serviceName: first.serviceName ?? first.serviceType,
      scheduledTime: first.scheduledTime,
      receivedAt: Date.now(),
    });
  }, [jobsKey, enabled, todayJobs, toast]);

  return { latestAlert, dismissAlert };
}

/** Listen for push messages relayed from the service worker while app is open. */
export function useStaffPushMessageAlerts(enabled: boolean) {
  const { toast } = useToast();
  const recentPushTagsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        title?: string;
        body?: string;
        url?: string;
        vibrate?: boolean;
        tag?: string;
      } | null;
      if (data?.type !== "CWP_STAFF_PUSH") return;

      const dedupeKey = data.tag ?? `${data.title ?? ""}:${data.body ?? ""}`;
      if (recentPushTagsRef.current.has(dedupeKey)) return;
      recentPushTagsRef.current.add(dedupeKey);
      setTimeout(() => recentPushTagsRef.current.delete(dedupeKey), 30_000);

      if (data.vibrate !== false) vibrateStaffJobAlert();

      toast({
        title: data.title ?? "New notification",
        description: data.body ?? "",
        duration: 8000,
      });
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [enabled, toast]);
}
