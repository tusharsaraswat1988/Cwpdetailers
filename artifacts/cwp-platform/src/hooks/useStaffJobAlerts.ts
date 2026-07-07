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

/** Walk-in / self-start: do not vibrate or show "New job assigned" for this booking. */
const suppressedAlertKeys = new Set<string>();

export function suppressStaffJobAlert(job: Pick<StaffJob, "id" | "source">) {
  suppressedAlertKeys.add(staffJobKey(job));
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
 * Vibrates + toast + returns alert state for in-app popup banner.
 */
export function useStaffJobAlerts(todayJobs: StaffJob[], enabled: boolean) {
  const { toast } = useToast();
  const knownKeysRef = useRef<Set<string> | null>(null);
  const alertedKeysRef = useRef<Set<string>>(new Set());
  const [latestAlert, setLatestAlert] = useState<StaffJobAlert | null>(null);

  const dismissAlert = useCallback(() => setLatestAlert(null), []);

  const jobsKey = useMemo(() => jobsSnapshotKey(todayJobs), [todayJobs]);

  useEffect(() => {
    if (!enabled) return;

    const currentKeys = new Set(todayJobs.map(staffJobKey));

    if (knownKeysRef.current === null) {
      knownKeysRef.current = currentKeys;
      return;
    }

    const newJobs = todayJobs.filter(j => {
      const key = staffJobKey(j);
      if (knownKeysRef.current!.has(key)) return false;
      if (j.status === "completed" || j.status === "cancelled") return false;
      if (suppressedAlertKeys.has(key)) {
        suppressedAlertKeys.delete(key);
        return false;
      }
      if (alertedKeysRef.current.has(key)) return false;
      return true;
    });

    knownKeysRef.current = currentKeys;

    if (newJobs.length === 0) return;

    for (const job of newJobs) {
      alertedKeysRef.current.add(staffJobKey(job));
    }

    vibrateStaffJobAlert();

    for (const job of newJobs) {
      const label = jobLabel(job);
      toast({
        title: "New job assigned",
        description: `${job.customerName ?? "Customer"} — ${label}`,
        duration: 8000,
      });
    }

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
      setTimeout(() => recentPushTagsRef.current.delete(dedupeKey), 15_000);

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
