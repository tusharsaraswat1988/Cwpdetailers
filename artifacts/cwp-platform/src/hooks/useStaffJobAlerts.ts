import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { vibrateStaffJobAlert } from "@/lib/staff-vibration";
import type { StaffJob } from "@/lib/staff-jobs";

export type StaffJobAlert = {
  id: number;
  customerName?: string;
  serviceName?: string | null;
  scheduledTime?: string | null;
  receivedAt: number;
};

function jobLabel(job: StaffJob) {
  const service = job.serviceName ?? job.serviceType?.replace(/_/g, " ") ?? "Job";
  return `${service}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}`;
}

/**
 * Watches today's job list for newly assigned work.
 * Vibrates + toast + returns alert state for in-app popup banner.
 */
export function useStaffJobAlerts(todayJobs: StaffJob[], enabled: boolean) {
  const { toast } = useToast();
  const knownIdsRef = useRef<Set<number> | null>(null);
  const [latestAlert, setLatestAlert] = useState<StaffJobAlert | null>(null);

  const dismissAlert = useCallback(() => setLatestAlert(null), []);

  useEffect(() => {
    if (!enabled || todayJobs.length === 0) {
      if (todayJobs.length === 0 && knownIdsRef.current === null) {
        knownIdsRef.current = new Set();
      }
      return;
    }

    const currentIds = new Set(todayJobs.map(j => j.id));

    if (knownIdsRef.current === null) {
      knownIdsRef.current = currentIds;
      return;
    }

    const newJobs = todayJobs.filter(
      j => !knownIdsRef.current!.has(j.id) && j.status !== "completed" && j.status !== "cancelled",
    );

    knownIdsRef.current = currentIds;

    if (newJobs.length === 0) return;

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
  }, [todayJobs, enabled, toast]);

  return { latestAlert, dismissAlert };
}

/** Listen for push messages relayed from the service worker while app is open. */
export function useStaffPushMessageAlerts(enabled: boolean) {
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        title?: string;
        body?: string;
        url?: string;
        vibrate?: boolean;
      } | null;
      if (data?.type !== "CWP_STAFF_PUSH") return;

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
