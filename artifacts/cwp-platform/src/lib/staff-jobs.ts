export type StaffJob = {
  id: number;
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
