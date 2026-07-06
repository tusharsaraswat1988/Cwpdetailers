import { MapPin, Phone, ArrowRight, CheckCircle, Loader2, Route } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GeoPhotoSlotGrid } from "@/components/staff/GeoPhotoSlotGrid";
import {
  type StaffJob,
  REQUIRED_SERVICE_PHOTOS,
  countJobPhotos,
  canCompleteOtherServiceJob,
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

export function StaffServiceJobFlow({
  job,
  transitionJob,
  uploadGeoPhoto,
  uploadingJobId,
  uploadingPhotoIndex,
  locatingJobId,
  isActionPending,
}: Props) {
  const [onWay, setOnWay] = useState(false);
  const btnClass = "w-full h-12 text-sm font-semibold";
  const isLocating = locatingJobId === job.id;
  const isUploading = uploadingJobId === job.id;
  const { before, after } = countJobPhotos(job);
  const addressLine = job.area ? `${job.area}, ${job.address}` : job.address;
  const headingToSite = job.status === "en_route" || (job.source === "execution" && job.status === "scheduled" && onWay);

  if (job.status === "completed") {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-green-600 text-sm font-medium bg-green-500/10 rounded-xl">
        <CheckCircle size={16} /> Job completed
      </div>
    );
  }

  if (job.status === "scheduled" && !headingToSite) {
    return (
      <div className="space-y-4">
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
            Customer site ke liye nikle, phir job start karein. 3 before + 3 after geo photos, phir close.
          </p>
        </div>
        <div className="flex gap-2">
          {job.customerPhone && (
            <a
              href={`tel:${job.customerPhone}`}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-border text-sm font-medium"
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
            >
              <MapPin size={15} /> Navigate
            </a>
          )}
        </div>
        <Button
          className={`${btnClass} bg-orange-500 hover:bg-orange-600 text-white`}
          onClick={() => {
            if (job.source === "execution") {
              setOnWay(true);
              return;
            }
            void transitionJob(job.id, "en_route", job);
          }}
          disabled={isActionPending}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Route size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "On My Way"}
        </Button>
      </div>
    );
  }

  if (headingToSite) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm">
          <p className="font-medium text-orange-700">En route</p>
          <p className="text-xs text-muted-foreground mt-1">Site par pahunch kar job start karein.</p>
        </div>
        <Button
          className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
          onClick={() => void transitionJob(job.id, "in_progress", job)}
          disabled={isActionPending}
        >
          {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <ArrowRight size={15} className="mr-2" />}
          {isLocating ? "Getting location…" : "Start Job"}
        </Button>
      </div>
    );
  }

  if (job.status === "in_progress") {
    const beforePhotos = job.beforePhotos ?? [];
    const afterPhotos = job.afterPhotos ?? [];
    const beforeDone = before >= REQUIRED_SERVICE_PHOTOS;
    const afterDone = after >= REQUIRED_SERVICE_PHOTOS;
    const canComplete = canCompleteOtherServiceJob(job);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StatusBadge status="in_progress" pulse />
          <p className="text-xs text-muted-foreground">GPS required on every photo</p>
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
          <GeoPhotoSlotGrid
            label="After — cleaned"
            description={`${REQUIRED_SERVICE_PHOTOS} photos required with live location`}
            photos={afterPhotos}
            uploadingIndex={isUploading && uploadingPhotoIndex != null && beforeDone && !afterDone ? uploadingPhotoIndex : null}
            disabled={afterDone}
            onCapture={file => void uploadGeoPhoto(job, "after", file, afterPhotos.length)}
          />
        )}

        {canComplete && (
          <Button
            className={`${btnClass} bg-green-600 hover:bg-green-700 text-white`}
            onClick={() => void transitionJob(job.id, "completed", job)}
            disabled={isActionPending}
          >
            {isLocating ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CheckCircle size={15} className="mr-2" />}
            {isLocating ? "Verifying location…" : "Close Job"}
          </Button>
        )}
      </div>
    );
  }

  return null;
}
