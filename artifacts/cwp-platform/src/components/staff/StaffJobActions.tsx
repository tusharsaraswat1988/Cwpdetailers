import { Button } from "@/components/ui/button";
import { Camera, CheckCircle, Route, ArrowRight, Loader2 } from "lucide-react";
import type { StaffJob } from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";

type Mutations = Pick<
  ReturnType<typeof useStaffJobsData>,
  "transitionJob" | "uploadPhoto" | "uploadingJobId" | "locatingJobId" | "isActionPending"
>;

interface Props extends Mutations {
  job: StaffJob;
  size?: "default" | "hero";
}

export function StaffJobActions({
  job,
  transitionJob,
  uploadPhoto,
  uploadingJobId,
  locatingJobId,
  isActionPending,
  size = "default",
}: Props) {
  const btnClass = size === "hero" ? "w-full h-14 text-base font-semibold" : "w-full h-12 text-sm font-semibold";
  const isLocating = locatingJobId === job.id;

  if (job.source === "execution") {
    if (job.status === "scheduled") {
      return (
        <Button
          className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
          onClick={() => void transitionJob(job.id, "in_progress", job)}
          disabled={isActionPending}
          data-testid={`btn-start-execution-${job.id}`}
        >
          {isLocating ? <Loader2 size={size === "hero" ? 18 : 15} className="mr-2 animate-spin" /> : <ArrowRight size={size === "hero" ? 18 : 15} className="mr-2" />}
          {isLocating ? "Getting location…" : "Start Job"}
        </Button>
      );
    }

    if (job.status === "in_progress") {
      return (
        <Button
          className={`${btnClass} bg-green-600 hover:bg-green-700 text-white`}
          onClick={() => void transitionJob(job.id, "completed", job)}
          disabled={isActionPending}
          data-testid={`btn-complete-execution-${job.id}`}
        >
          {isLocating ? <Loader2 size={size === "hero" ? 18 : 15} className="mr-2 animate-spin" /> : <CheckCircle size={size === "hero" ? 18 : 15} className="mr-2" />}
          {isLocating ? "Verifying location…" : "Complete Job"}
        </Button>
      );
    }

    if (job.status === "completed") {
      return (
        <div className="flex items-center justify-center gap-2 py-4 text-green-600 text-sm font-medium bg-green-500/10 rounded-xl">
          <CheckCircle size={16} /> Job completed
        </div>
      );
    }

    return null;
  }

  if (job.status === "scheduled") {
    return (
      <Button
        className={`${btnClass} bg-orange-500 hover:bg-orange-600 text-white`}
        onClick={() => void transitionJob(job.id, "en_route", job)}
        disabled={isActionPending}
        data-testid={`btn-en-route-${job.id}`}
      >
        {isLocating ? <Loader2 size={size === "hero" ? 18 : 15} className="mr-2 animate-spin" /> : <Route size={size === "hero" ? 18 : 15} className="mr-2" />}
        {isLocating ? "Getting location…" : "On My Way"}
      </Button>
    );
  }

  if (job.status === "en_route" && !job.beforePhotoUrl) {
    return (
      <Button
        className={`${btnClass} relative`}
        variant="outline"
        disabled={uploadingJobId === job.id}
        data-testid={`btn-before-photo-${job.id}`}
      >
        <Camera size={size === "hero" ? 18 : 15} className="mr-2" />
        {uploadingJobId === job.id ? "Uploading..." : "Take Before Photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) uploadPhoto(job.id, "beforePhotoUrl", f);
            e.target.value = "";
          }}
        />
      </Button>
    );
  }

  if (job.status === "en_route" && job.beforePhotoUrl) {
    return (
      <Button
        className={`${btnClass} bg-primary text-secondary hover:bg-primary/90`}
        onClick={() => void transitionJob(job.id, "in_progress", job)}
        disabled={isActionPending}
        data-testid={`btn-start-job-${job.id}`}
      >
        {isLocating ? <Loader2 size={size === "hero" ? 18 : 15} className="mr-2 animate-spin" /> : <ArrowRight size={size === "hero" ? 18 : 15} className="mr-2" />}
        {isLocating ? "Verifying location…" : "Start Job"}
      </Button>
    );
  }

  if (job.status === "in_progress" && !job.afterPhotoUrl) {
    return (
      <Button
        className={`${btnClass} relative`}
        variant="outline"
        disabled={uploadingJobId === job.id}
        data-testid={`btn-after-photo-${job.id}`}
      >
        <Camera size={size === "hero" ? 18 : 15} className="mr-2" />
        {uploadingJobId === job.id ? "Uploading..." : "Take After Photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) uploadPhoto(job.id, "afterPhotoUrl", f);
            e.target.value = "";
          }}
        />
      </Button>
    );
  }

  if (job.status === "in_progress" && job.afterPhotoUrl) {
    return (
      <Button
        className={`${btnClass} bg-green-600 hover:bg-green-700 text-white`}
        onClick={() => void transitionJob(job.id, "completed", job)}
        disabled={isActionPending}
        data-testid={`btn-complete-${job.id}`}
      >
        {isLocating ? <Loader2 size={size === "hero" ? 18 : 15} className="mr-2 animate-spin" /> : <CheckCircle size={size === "hero" ? 18 : 15} className="mr-2" />}
        {isLocating ? "Verifying location…" : "Complete Job"}
      </Button>
    );
  }

  if (job.status === "completed") {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-green-600 text-sm font-medium bg-green-500/10 rounded-xl">
        <CheckCircle size={16} /> Job completed
      </div>
    );
  }

  return null;
}
