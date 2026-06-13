import { Button } from "@/components/ui/button";
import { Camera, CheckCircle, Route, ArrowRight } from "lucide-react";
import type { StaffJob } from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";

type Mutations = Pick<ReturnType<typeof useStaffJobsData>, "transitionMutation" | "uploadPhoto" | "uploadingJobId" | "isActionPending">;

interface Props extends Mutations {
  job: StaffJob;
  size?: "default" | "hero";
}

export function StaffJobActions({
  job,
  transitionMutation,
  uploadPhoto,
  uploadingJobId,
  isActionPending,
  size = "default",
}: Props) {
  const btnClass = size === "hero" ? "w-full h-14 text-base font-semibold" : "w-full h-12 text-sm font-semibold";

  if (job.status === "scheduled") {
    return (
      <Button
        className={`${btnClass} bg-orange-500 hover:bg-orange-600 text-white`}
        onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "en_route" } })}
        disabled={isActionPending}
        data-testid={`btn-en-route-${job.id}`}
      >
        <Route size={size === "hero" ? 18 : 15} className="mr-2" />
        On My Way
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
        onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "in_progress" } })}
        disabled={isActionPending}
        data-testid={`btn-start-job-${job.id}`}
      >
        <ArrowRight size={size === "hero" ? 18 : 15} className="mr-2" />
        Start Job
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
        onClick={() => transitionMutation.mutate({ id: job.id, data: { toStatus: "completed" } })}
        disabled={isActionPending}
        data-testid={`btn-complete-${job.id}`}
      >
        <CheckCircle size={size === "hero" ? 18 : 15} className="mr-2" />
        Complete Job
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
