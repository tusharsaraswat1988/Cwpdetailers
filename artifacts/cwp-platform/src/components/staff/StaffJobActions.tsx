import { Camera, CheckCircle, Route, ArrowRight, Loader2 } from "lucide-react";
import type { StaffJob } from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { StaffButton, StaffSuccessBanner, StaffSyncChip } from "@/features/staff-ds";
import { captureStaffPhoto, isCameraCancel } from "@/lib/native/captureStaffPhoto";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const btnClass = size === "hero" ? "w-full" : "w-full";
  const iconSize = size === "hero" ? 18 : 15;
  const isLocating = locatingJobId === job.id;
  const isUploading = uploadingJobId === job.id;

  if (job.source === "execution") {
    if (job.status === "scheduled") {
      return (
        <StaffButton
          className={btnClass}
          onClick={() => void transitionJob(job.id, "in_progress", job)}
          disabled={isActionPending}
          data-testid={`btn-start-execution-${job.id}`}
        >
          {isLocating ? (
            <Loader2 size={iconSize} className="mr-2 animate-spin" />
          ) : (
            <ArrowRight size={iconSize} className="mr-2" />
          )}
          {isLocating ? "Getting location…" : "Start Job"}
        </StaffButton>
      );
    }

    if (job.status === "in_progress") {
      return (
        <StaffButton
          className={`${btnClass} bg-[hsl(var(--tone-success))] hover:bg-[hsl(var(--tone-success)/0.9)] text-white`}
          onClick={() => void transitionJob(job.id, "completed", job)}
          disabled={isActionPending}
          data-testid={`btn-complete-execution-${job.id}`}
        >
          {isLocating ? (
            <Loader2 size={iconSize} className="mr-2 animate-spin" />
          ) : (
            <CheckCircle size={iconSize} className="mr-2" />
          )}
          {isLocating ? "Verifying location…" : "Complete Job"}
        </StaffButton>
      );
    }

    if (job.status === "completed") {
      return <StaffSuccessBanner title="Job completed" description="Marked complete and ready for verification." />;
    }

    return null;
  }

  if (job.status === "scheduled") {
    return (
      <StaffButton
        className={`${btnClass} bg-[hsl(var(--tone-warning))] hover:bg-[hsl(var(--tone-warning)/0.9)] text-white`}
        onClick={() => void transitionJob(job.id, "en_route", job)}
        disabled={isActionPending}
        data-testid={`btn-en-route-${job.id}`}
      >
        {isLocating ? (
          <Loader2 size={iconSize} className="mr-2 animate-spin" />
        ) : (
          <Route size={iconSize} className="mr-2" />
        )}
        {isLocating ? "Getting location…" : "On My Way"}
      </StaffButton>
    );
  }

  if (job.status === "en_route" && !job.beforePhotoUrl) {
    return (
      <div className="space-y-2">
        {isUploading ? <StaffSyncChip state="uploading" /> : null}
        <StaffButton
          className={`${btnClass}`}
          variant="outline"
          disabled={isUploading}
          data-testid={`btn-before-photo-${job.id}`}
          onClick={() => {
            void (async () => {
              try {
                const photo = await captureStaffPhoto("rear");
                uploadPhoto(job.id, "beforePhotoUrl", photo.file);
              } catch (err) {
                if (isCameraCancel(err)) return;
                toast({
                  title: "Camera failed",
                  description: err instanceof Error ? err.message : "Could not capture photo",
                  variant: "destructive",
                });
              }
            })();
          }}
        >
          <Camera size={iconSize} className="mr-2" />
          {isUploading ? "Uploading…" : "Take Before Photo"}
        </StaffButton>
      </div>
    );
  }

  if (job.status === "en_route" && job.beforePhotoUrl) {
    return (
      <StaffButton
        className={btnClass}
        onClick={() => void transitionJob(job.id, "in_progress", job)}
        disabled={isActionPending}
        data-testid={`btn-start-job-${job.id}`}
      >
        {isLocating ? (
          <Loader2 size={iconSize} className="mr-2 animate-spin" />
        ) : (
          <ArrowRight size={iconSize} className="mr-2" />
        )}
        {isLocating ? "Verifying location…" : "Start Job"}
      </StaffButton>
    );
  }

  if (job.status === "in_progress" && !job.afterPhotoUrl) {
    return (
      <div className="space-y-2">
        {isUploading ? <StaffSyncChip state="uploading" /> : null}
        <StaffButton
          className={`${btnClass}`}
          variant="outline"
          disabled={isUploading}
          data-testid={`btn-after-photo-${job.id}`}
          onClick={() => {
            void (async () => {
              try {
                const photo = await captureStaffPhoto("rear");
                uploadPhoto(job.id, "afterPhotoUrl", photo.file);
              } catch (err) {
                if (isCameraCancel(err)) return;
                toast({
                  title: "Camera failed",
                  description: err instanceof Error ? err.message : "Could not capture photo",
                  variant: "destructive",
                });
              }
            })();
          }}
        >
          <Camera size={iconSize} className="mr-2" />
          {isUploading ? "Uploading…" : "Take After Photo"}
        </StaffButton>
      </div>
    );
  }

  if (job.status === "in_progress" && job.afterPhotoUrl) {
    return (
      <StaffButton
        className={`${btnClass} bg-[hsl(var(--tone-success))] hover:bg-[hsl(var(--tone-success)/0.9)] text-white`}
        onClick={() => void transitionJob(job.id, "completed", job)}
        disabled={isActionPending}
        data-testid={`btn-complete-${job.id}`}
      >
        {isLocating ? (
          <Loader2 size={iconSize} className="mr-2 animate-spin" />
        ) : (
          <CheckCircle size={iconSize} className="mr-2" />
        )}
        {isLocating ? "Verifying location…" : "Complete Job"}
      </StaffButton>
    );
  }

  if (job.status === "completed") {
    return <StaffSuccessBanner title="Job completed" description="Photos saved. Job ready for verification." />;
  }

  return null;
}
