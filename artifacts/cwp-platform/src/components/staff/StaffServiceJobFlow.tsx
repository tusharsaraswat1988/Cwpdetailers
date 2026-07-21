import { resolveMediaUrl } from "@/lib/media-url";
import { MapPin, Phone, ArrowRight, CheckCircle, Loader2, Route, ClipboardCheck, Navigation, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { StaffButton as Button, StaffStatusBadge } from "@/features/staff-ds";
import { Textarea } from "@/components/ui/textarea";
import { GeoPhotoSlotGrid } from "@/components/staff/GeoPhotoSlotGrid";
import {
  type StaffJob,
  REQUIRED_SERVICE_PHOTOS,
  countJobPhotos,
  canCompleteOtherServiceJob,
  getJobPhotoArrays,
} from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { buildNavigateUrl, canNavigateTo } from "@/lib/maps";

type Mutations = Pick<
  ReturnType<typeof useStaffJobsData>,
  | "transitionJob"
  | "uploadGeoPhoto"
  | "completeJobWithNotes"
  | "uploadingJobId"
  | "uploadingPhotoIndex"
  | "locatingJobId"
  | "isActionPending"
>;

interface Props extends Mutations {
  job: StaffJob;
}

function JobContactActions({ job, addressLine }: { job: StaffJob; addressLine: string | undefined }) {
  if (!job.customerPhone && !canNavigateTo(job) && !addressLine) return null;
  return (
    <div className="flex gap-2">
      {job.customerPhone && (
        <a
          href={`tel:${job.customerPhone}`}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-border text-sm font-medium"
          data-testid={`job-call-${job.id}`}
        >
          <Phone size={15} className="text-green-600" /> Call
        </a>
      )}
      {canNavigateTo(job) && (
        <a
          href={buildNavigateUrl(job)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-primary/30 bg-primary/5 text-sm font-medium text-primary"
          data-testid={`job-navigate-${job.id}`}
        >
          <Navigation size={15} /> Navigate
        </a>
      )}
    </div>
  );
}

function JobDetailsCard({ job, addressLine }: { job: StaffJob; addressLine: string | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 text-sm">
      <p className="font-medium">Job details</p>
      {job.vehicleName && <p className="text-muted-foreground">Vehicle: {job.vehicleName}</p>}
      {addressLine && (
        <div className="flex items-start gap-2 text-muted-foreground">
          <MapPin size={14} className="shrink-0 mt-0.5 text-primary" />
          <span>{addressLine}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        3 before photos → car wash → 3 after photos → remark → complete.
      </p>
    </div>
  );
}

function formatCompletedAt(value: string | null | undefined) {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? format(d, "d MMM yyyy, h:mm a") : value;
}

export function StaffServiceJobFlow({
  job,
  transitionJob,
  uploadGeoPhoto,
  completeJobWithNotes,
  uploadingJobId,
  uploadingPhotoIndex,
  locatingJobId,
  isActionPending,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [onWay, setOnWay] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [readyForAfter, setReadyForAfter] = useState(false);
  const [remarks, setRemarks] = useState("");

  const { before, after } = countJobPhotos(job);

  useEffect(() => {
    setAccepted(false);
    setOnWay(false);
    setArrived(false);
    setReadyForAfter(after > 0);
    setRemarks(job.technicianNotes ?? "");
  }, [job.id, job.source, job.status, after, job.technicianNotes]);

  const btnClass = "w-full h-12 text-sm font-semibold";
  const isLocating = locatingJobId === job.id;
  const isUploading = uploadingJobId === job.id;
  const { beforePhotos, afterPhotos } = getJobPhotoArrays(job);
  const addressLine = job.area ? `${job.area}, ${job.address}` : job.address ?? undefined;
  const isExecution = job.source === "execution";
  const beforeDone = before >= REQUIRED_SERVICE_PHOTOS;
  const afterDone = after >= REQUIRED_SERVICE_PHOTOS;
  const canComplete = canCompleteOtherServiceJob(job);

  const isAccepted = job.status === "confirmed" || (isExecution && job.status === "scheduled" && accepted);
  const isEnRoute =
    job.status === "en_route" || (isExecution && job.status === "scheduled" && accepted && onWay);

  const readyToStartWork = job.status === "en_route" && arrived && beforeDone;

  const onSiteForBefore =
    (job.status === "en_route" && arrived && !beforeDone)
    || (job.status === "in_progress" && !beforeDone);

  const onSiteForWashing =
    job.status === "in_progress"
    && beforeDone
    && !readyForAfter
    && after === 0;

  const onSiteForAfter =
    job.status === "in_progress"
    && beforeDone
    && readyForAfter
    && !afterDone;

  const onSiteForWrapUp =
    job.status === "in_progress"
    && beforeDone
    && afterDone;

  if (job.status === "completed") {
    const completedLabel = formatCompletedAt(job.completedAt);
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium bg-green-500/10 rounded-xl py-4">
          <CheckCircle size={16} /> Job completed
        </div>
        {completedLabel && (
          <p className="text-center text-xs text-muted-foreground">
            Completed on {completedLabel}
          </p>
        )}
        {job.technicianNotes && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground mb-1">Remark</p>
            <p>{job.technicianNotes}</p>
          </div>
        )}
      </div>
    );
  }

  if (isExecution && job.status === "paused") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium text-amber-800">Work paused</p>
          <p className="text-xs text-muted-foreground mt-1">Resume when you are ready to continue.</p>
        </div>
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
          onClick={() => void transitionJob(job.id, "resume", job)}
          disabled={isActionPending}
          data-testid={`btn-resume-${job.id}`}
        >
          {isActionPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Play size={15} className="mr-2" />}
          Resume Work
        </Button>
      </div>
    );
  }

  if (job.status === "scheduled" && !isExecution) {
    return (
      <div className="space-y-4">
        <JobDetailsCard job={job} addressLine={addressLine} />
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-orange-500 hover:bg-orange-600 text-white`}
          onClick={() => void transitionJob(job.id, "confirmed", job)}
          disabled={isActionPending}
          data-testid={`btn-accept-booking-${job.id}`}
        >
          <ClipboardCheck size={15} className="mr-2" />
          Accept Booking
        </Button>
      </div>
    );
  }

  if (isExecution && job.status === "scheduled" && !accepted) {
    return (
      <div className="space-y-4">
        <JobDetailsCard job={job} addressLine={addressLine} />
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-orange-500 hover:bg-orange-600 text-white`}
          onClick={() => setAccepted(true)}
          disabled={isActionPending}
          data-testid={`btn-accept-job-${job.id}`}
        >
          <ClipboardCheck size={15} className="mr-2" />
          Accept Job
        </Button>
      </div>
    );
  }

  if (isAccepted && !isEnRoute && job.status !== "in_progress") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-primary">Booking accepted</p>
          <p className="text-xs text-muted-foreground mt-1">Customer site ke liye nikalne par &quot;On My Way&quot; dabayein.</p>
        </div>
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-orange-500 hover:bg-orange-600 text-white`}
          onClick={() => {
            if (isExecution) {
              setOnWay(true);
              return;
            }
            void transitionJob(job.id, "en_route", job);
          }}
          disabled={isActionPending}
          data-testid={`btn-en-route-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Route size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "On My Way"}
        </Button>
      </div>
    );
  }

  if (isEnRoute && !arrived && job.status !== "in_progress") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm">
          <p className="font-medium text-orange-700">En route</p>
          <p className="text-xs text-muted-foreground mt-1">Site par pahunch kar &quot;Arrived&quot; dabayein.</p>
        </div>
        <JobContactActions job={job} addressLine={addressLine} />
        <Button
          className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
          onClick={() => {
            if (isExecution) {
              void transitionJob(job.id, "in_progress", job);
              return;
            }
            setArrived(true);
          }}
          disabled={isActionPending}
          data-testid={`btn-arrived-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <MapPin size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "Arrived"}
        </Button>
      </div>
    );
  }

  if (readyToStartWork) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-primary">Before photos done</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ab car wash shuru karein. Kaam khatam hone ke baad clean car ki photos lenge.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {beforePhotos.map((photo, i) => (
            <div key={photo.url} className="aspect-square rounded-xl overflow-hidden border border-green-500/30">
              <img src={resolveMediaUrl(photo.url)} alt={`Before ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        <Button
          className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
          onClick={() => void transitionJob(job.id, "in_progress", job)}
          disabled={isActionPending}
          data-testid={`btn-start-work-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <ArrowRight size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "Start Work"}
        </Button>
      </div>
    );
  }

  if (onSiteForBefore) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StaffStatusBadge status={job.status === "in_progress" ? "in_progress" : "en_route"} />
          <p className="text-xs text-muted-foreground">Step 1 — Before photos (dirty car)</p>
        </div>
        <GeoPhotoSlotGrid
          label="Before — uncleaned"
          description={`${REQUIRED_SERVICE_PHOTOS} photos required with live location`}
          photos={beforePhotos}
          uploadingIndex={isUploading && uploadingPhotoIndex != null ? uploadingPhotoIndex : null}
          disabled={beforeDone}
          onCapture={file => void uploadGeoPhoto(job, "before", file, beforePhotos.length)}
        />
      </div>
    );
  }

  if (onSiteForWashing) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <StaffStatusBadge status="in_progress" pulse />
            <p className="font-medium text-blue-800">Service in progress</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Step 2 — Complete the service. When finished, continue to after photos.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 opacity-80">
          {beforePhotos.map((photo, i) => (
            <div key={photo.url} className="aspect-square rounded-xl overflow-hidden border border-green-500/30">
              <img src={resolveMediaUrl(photo.url)} alt={`Before ${i + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        {isExecution && (
          <Button
            variant="outline"
            className={btnClass}
            onClick={() => void transitionJob(job.id, "paused", job)}
            disabled={isActionPending}
            data-testid={`btn-pause-${job.id}`}
          >
            <Pause size={15} className="mr-2" />
            Pause Work
          </Button>
        )}
        <Button
          className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
          onClick={() => setReadyForAfter(true)}
          disabled={isActionPending}
          data-testid={`btn-wash-done-${job.id}`}
        >
          <CheckCircle size={15} className="mr-2" />
          Service Done — After Photos
        </Button>
      </div>
    );
  }

  if (onSiteForAfter) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StaffStatusBadge status="in_progress" pulse />
          <p className="text-xs text-muted-foreground">Step 3 — After photos (clean car)</p>
        </div>

        <GeoPhotoSlotGrid
          label="After — cleaned"
          description={`${REQUIRED_SERVICE_PHOTOS} photos required with live location`}
          photos={afterPhotos}
          uploadingIndex={isUploading && uploadingPhotoIndex != null ? uploadingPhotoIndex : null}
          disabled={false}
          onCapture={file => void uploadGeoPhoto(job, "after", file, afterPhotos.length)}
        />
      </div>
    );
  }

  if (onSiteForWrapUp || canComplete) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StaffStatusBadge status="in_progress" pulse />
          <p className="text-xs text-muted-foreground">Step 4 — Remark &amp; complete</p>
        </div>

        <div className="space-y-2">
          <label htmlFor={`remarks-${job.id}`} className="text-sm font-medium">
            Remark (optional)
          </label>
          <Textarea
            id={`remarks-${job.id}`}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Koi note — scratch, extra dirt, customer request…"
            rows={3}
            className="resize-none"
          />
        </div>

        <Button
          className={`${btnClass} bg-green-600 hover:bg-green-700 text-white`}
          onClick={() => void completeJobWithNotes(job, remarks)}
          disabled={isActionPending || !canComplete}
          data-testid={`btn-complete-${job.id}`}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle size={15} className="mr-2" />}
          {isLocating ? "Verifying location…" : "Submit & Complete Job"}
        </Button>
      </div>
    );
  }

  return null;
}
