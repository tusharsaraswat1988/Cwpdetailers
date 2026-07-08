import { MapPin, Phone, ArrowRight, CheckCircle, Loader2, Route, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GeoPhotoSlotGrid } from "@/components/staff/GeoPhotoSlotGrid";
import {
  type StaffJob,
  REQUIRED_SERVICE_PHOTOS,
  countJobPhotos,
  canCompleteOtherServiceJob,
  getJobPhotoArrays,
} from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";

type Mutations = Pick<
  ReturnType<typeof useStaffJobsData>,
  | "transitionJob"
  | "uploadGeoPhoto"
  | "uploadingJobId"
  | "uploadingPhotoIndex"
  | "locatingJobId"
  | "isActionPending"
>;

interface Props extends Mutations {
  job: StaffJob;
}

function JobContactActions({ job, addressLine }: { job: StaffJob; addressLine: string | undefined }) {
  if (!job.customerPhone && !addressLine) return null;
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
      {addressLine && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(addressLine)}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-primary/30 bg-primary/5 text-sm font-medium text-primary"
          data-testid={`job-navigate-${job.id}`}
        >
          <MapPin size={15} /> Navigate
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
        Accept karein, site ke liye nikle, 3 before + 3 after geo photos, phir close.
      </p>
    </div>
  );
}

export function StaffServiceJobFlow({
  job,
  transitionJob,
  uploadGeoPhoto,
  uploadingJobId,
  uploadingPhotoIndex,
  locatingJobId,
  isActionPending,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [onWay, setOnWay] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [workStarted, setWorkStarted] = useState(false);

  useEffect(() => {
    setAccepted(false);
    setOnWay(false);
    setArrived(false);
    setWorkStarted(job.status === "in_progress");
  }, [job.id, job.source, job.status]);

  const btnClass = "w-full h-12 text-sm font-semibold";
  const isLocating = locatingJobId === job.id;
  const isUploading = uploadingJobId === job.id;
  const { before, after } = countJobPhotos(job);
  const { beforePhotos, afterPhotos } = getJobPhotoArrays(job);
  const addressLine = job.area ? `${job.area}, ${job.address}` : job.address ?? undefined;
  const isExecution = job.source === "execution";
  const beforeDone = before >= REQUIRED_SERVICE_PHOTOS;
  const afterDone = after >= REQUIRED_SERVICE_PHOTOS;
  const canComplete = canCompleteOtherServiceJob(job);

  const isAccepted = job.status === "confirmed" || (isExecution && job.status === "scheduled" && accepted);
  const isEnRoute =
    job.status === "en_route" || (isExecution && job.status === "scheduled" && accepted && onWay);
  const onSiteForBefore =
    (job.status === "en_route" && arrived)
    || (job.status === "in_progress" && !beforeDone)
    || (isExecution && job.status === "in_progress" && !workStarted && !beforeDone);
  const onSiteForAfter =
    (job.status === "in_progress" && beforeDone)
    || (isExecution && workStarted && beforeDone);

  if (job.status === "completed") {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-green-600 text-sm font-medium bg-green-500/10 rounded-xl">
        <CheckCircle size={16} /> Job completed
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
          data-testid={`btn-accept-booking-${job.id}`}
        >
          <ClipboardCheck size={15} className="mr-2" />
          Accept Booking
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

  if (onSiteForBefore) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StatusBadge status={job.status === "in_progress" ? "in_progress" : "en_route"} />
          <p className="text-xs text-muted-foreground">Before photos — GPS required</p>
        </div>
        <GeoPhotoSlotGrid
          label="Before — uncleaned"
          description={`${REQUIRED_SERVICE_PHOTOS} photos required with live location`}
          photos={beforePhotos}
          uploadingIndex={isUploading && uploadingPhotoIndex != null && !beforeDone ? uploadingPhotoIndex : null}
          disabled={beforeDone}
          onCapture={file => void uploadGeoPhoto(job, "before", file, beforePhotos.length)}
        />
        {beforeDone && (
          <Button
            className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
            onClick={() => {
              if (isExecution) {
                setWorkStarted(true);
                return;
              }
              void transitionJob(job.id, "in_progress", job);
            }}
            disabled={isActionPending}
            data-testid={`btn-start-work-${job.id}`}
          >
            {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <ArrowRight size={15} className="mr-2" />}
            {isLocating ? "Getting location…" : "Start Work"}
          </Button>
        )}
      </div>
    );
  }

  if (onSiteForAfter) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StatusBadge status="in_progress" pulse />
          <p className="text-xs text-muted-foreground">After photos — GPS required</p>
        </div>

        <GeoPhotoSlotGrid
          label="After — cleaned"
          description={`${REQUIRED_SERVICE_PHOTOS} photos required with live location`}
          photos={afterPhotos}
          uploadingIndex={isUploading && uploadingPhotoIndex != null && !afterDone ? uploadingPhotoIndex : null}
          disabled={afterDone}
          onCapture={file => void uploadGeoPhoto(job, "after", file, afterPhotos.length)}
        />

        {canComplete && (
          <Button
            className={`${btnClass} bg-green-600 hover:bg-green-700 text-white`}
            onClick={() => void transitionJob(job.id, "completed", job)}
            disabled={isActionPending}
            data-testid={`btn-complete-${job.id}`}
          >
            {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle size={15} className="mr-2" />}
            {isLocating ? "Verifying location…" : "Submit & Complete"}
          </Button>
        )}
      </div>
    );
  }

  return null;
}
