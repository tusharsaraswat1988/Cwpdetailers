export type StaffJob = {
  id: number;
  source?: "booking" | "execution";
  executionId?: number;
  customerName?: string;
  customerPhone?: string;
  serviceType?: string | null;
  serviceName?: string | null;
  scheduledDate?: string;
  scheduledTime?: string | null;
  status?: string;
  address?: string | null;
  area?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  amount?: string | number | null;
  vehicleName?: string | null;
};

export function staffJobKey(job: StaffJob) {
  return `${job.source ?? "booking"}-${job.id}`;
}

const EXECUTION_STATUS_MAP: Record<string, string> = {
  scheduled: "scheduled",
  started: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
  missed: "cancelled",
  rescheduled: "cancelled",
};

export function executionToStaffJob(e: {
  id: number;
  customerName: string;
  serviceLabel?: string | null;
  assetLabel?: string | null;
  serviceLocationLabel?: string | null;
  serviceLocationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  status: string;
  taskType?: string | null;
  taskTypeLabel?: string | null;
  isSubstitute?: boolean;
}): StaffJob {
  const taskLabel = e.taskTypeLabel ?? (e.taskType ? e.taskType.replace(/_/g, " ") : null);
  const baseName = e.serviceLabel ?? undefined;
  const serviceName = taskLabel
    ? `${baseName ?? "Service"} — ${taskLabel}${e.isSubstitute ? " (substitute)" : ""}`
    : baseName;

  return {
    source: "execution",
    id: e.id,
    executionId: e.id,
    customerName: e.customerName,
    serviceName,
    serviceType: taskLabel ?? e.serviceLabel ?? "assigned service",
    scheduledDate: e.scheduledDate.slice(0, 10),
    scheduledTime: e.scheduledTime,
    status: EXECUTION_STATUS_MAP[e.status] ?? e.status,
    address: e.serviceLocationAddress ?? e.serviceLocationLabel,
    locationLat: e.locationLatitude,
    locationLng: e.locationLongitude,
    vehicleName: e.assetLabel,
  };
}

export function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export function partitionStaffJobs(all: StaffJob[], todayList: StaffJob[]) {
  const todayStr = todayIso();
  const upcoming = all.filter(
    j => j.scheduledDate && j.scheduledDate > todayStr && j.status !== "completed" && j.status !== "cancelled",
  );
  const done = all.filter(j => j.status === "completed" || j.status === "cancelled");
  return { today: todayList, upcoming, done };
}

/** Active focus job: in-progress route first, else first scheduled today */
export function pickActiveJob(todayJobs: StaffJob[]): StaffJob | null {
  const active =
    todayJobs.find(j => j.status === "en_route" || j.status === "in_progress") ??
    todayJobs.find(j => j.status === "scheduled");
  return active ?? null;
}

export function formatJobDateHeader(dateStr: string) {
  const today = todayIso();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

export function groupJobsByDate(jobs: StaffJob[]) {
  const grouped = jobs.reduce<Record<string, StaffJob[]>>((acc, job) => {
    const key = job.scheduledDate ?? "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});
  return Object.keys(grouped)
    .sort()
    .map(dateKey => ({ dateKey, jobs: grouped[dateKey] }));
}

export function jobAmount(job: StaffJob) {
  return Number(job.amount ?? 0);
}
