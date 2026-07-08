export type GeoTaggedPhoto = {
  url: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type StaffJob = {
  id: number;
  source?: "booking" | "execution";
  executionId?: number;
  taskType?: string | null;
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
  proofPhotoUrls?: string[] | null;
  beforePhotos?: GeoTaggedPhoto[];
  afterPhotos?: GeoTaggedPhoto[];
  amount?: string | number | null;
  vehicleName?: string | null;
  technicianNotes?: string | null;
  completedAt?: string | null;
  startedAt?: string | null;
};

/** Required geo-tagged photos per phase for car wash & other on-site services */
export const REQUIRED_SERVICE_PHOTOS = 3;

/** Split proofPhotoUrls into before/after geo photo arrays (supports partial uploads). */
export function parseProofPhotos(proof: string[] | null | undefined): {
  beforePhotos: GeoTaggedPhoto[];
  afterPhotos: GeoTaggedPhoto[];
} {
  const urls = proof ?? [];
  const toPhoto = (url: string): GeoTaggedPhoto => ({ url, latitude: 0, longitude: 0 });
  return {
    beforePhotos: urls.slice(0, REQUIRED_SERVICE_PHOTOS).map(toPhoto),
    afterPhotos: urls.slice(REQUIRED_SERVICE_PHOTOS, REQUIRED_SERVICE_PHOTOS * 2).map(toPhoto),
  };
}

/** Resolved before/after photo arrays for a job (bookings + executions). */
export function getJobPhotoArrays(job: StaffJob): {
  beforePhotos: GeoTaggedPhoto[];
  afterPhotos: GeoTaggedPhoto[];
} {
  if (job.beforePhotos?.length || job.afterPhotos?.length) {
    return {
      beforePhotos: job.beforePhotos ?? [],
      afterPhotos: job.afterPhotos ?? [],
    };
  }
  if (job.proofPhotoUrls?.length) {
    return parseProofPhotos(job.proofPhotoUrls);
  }
  const beforePhotos: GeoTaggedPhoto[] = job.beforePhotoUrl
    ? [{ url: job.beforePhotoUrl, latitude: 0, longitude: 0 }]
    : [];
  const afterPhotos: GeoTaggedPhoto[] = job.afterPhotoUrl
    ? [{ url: job.afterPhotoUrl, latitude: 0, longitude: 0 }]
    : [];
  return { beforePhotos, afterPhotos };
}

export function isDailyCleanJob(job: Pick<StaffJob, "taskType" | "serviceType">) {
  const task = (job.taskType ?? "").toLowerCase();
  const svc = (job.serviceType ?? "").toLowerCase();
  return task === "daily_cleaning" || svc.includes("daily clean");
}

export function isOtherServiceJob(job: Pick<StaffJob, "taskType" | "serviceType">) {
  return !isDailyCleanJob(job);
}

export function partitionJobsByCategory(jobs: StaffJob[]) {
  const dailyClean: StaffJob[] = [];
  const otherServices: StaffJob[] = [];
  for (const job of jobs) {
    if (isDailyCleanJob(job)) dailyClean.push(job);
    else otherServices.push(job);
  }
  return { dailyClean, otherServices };
}

export function countJobPhotos(job: StaffJob) {
  const { beforePhotos, afterPhotos } = getJobPhotoArrays(job);
  return {
    before: beforePhotos.length,
    after: afterPhotos.length,
  };
}

export function canCompleteOtherServiceJob(job: StaffJob) {
  const { before, after } = countJobPhotos(job);
  return job.status === "in_progress" && before >= REQUIRED_SERVICE_PHOTOS && after >= REQUIRED_SERVICE_PHOTOS;
}

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
    taskType: e.taskType ?? null,
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
