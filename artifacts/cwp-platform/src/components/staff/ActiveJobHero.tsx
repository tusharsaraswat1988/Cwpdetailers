import { MapPin, Phone } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StaffJobActions } from "@/components/staff/StaffJobActions";
import { StaffServiceJobFlow } from "@/components/staff/StaffServiceJobFlow";
import { isOtherServiceJob } from "@/lib/staff-jobs";
import { resolveMediaUrl } from "@/lib/media-url";
import type { StaffJob } from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";

type Mutations = Pick<
  ReturnType<typeof useStaffJobsData>,
  | "transitionJob"
  | "uploadPhoto"
  | "uploadGeoPhoto"
  | "uploadingJobId"
  | "uploadingPhotoIndex"
  | "locatingJobId"
  | "isActionPending"
>;

interface Props extends Mutations {
  job: StaffJob;
}

export function ActiveJobHero({ job, ...actions }: Props) {
  const isLive = job.status === "en_route" || job.status === "in_progress";
  const addressLine = job.area ? `${job.area}, ${job.address}` : job.address;

  return (
    <section
      className="rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-card p-5 space-y-4 shadow-sm"
      data-testid={`active-job-hero-${job.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
            {isLive ? "Active job" : "Next job"}
          </p>
          <h2 className="font-display font-bold text-xl leading-tight truncate">{job.customerName}</h2>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {job.serviceType?.replace(/_/g, " ")}
            {job.serviceName ? ` · ${job.serviceName}` : ""}
            {job.scheduledTime ? ` · ${job.scheduledTime}` : ""}
          </p>
          {job.vehicleName && (
            <p className="text-xs text-muted-foreground mt-0.5">{job.vehicleName}</p>
          )}
        </div>
        <StatusBadge status={job.status ?? "scheduled"} pulse={isLive} className="shrink-0" />
      </div>

      {addressLine && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-xl p-3">
          <MapPin size={16} className="shrink-0 text-primary mt-0.5" />
          <span>{addressLine}</span>
        </div>
      )}

      {isLive && (
        <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
          GPS required for job updates. Start and complete only within 150m of the customer location.
        </p>
      )}

      {!isOtherServiceJob(job) && (
        <div className="flex gap-2">
          {job.customerPhone && (
            <a
              href={`tel:${job.customerPhone}`}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
              data-testid={`hero-call-${job.id}`}
            >
              <Phone size={16} className="text-green-600" />
              Call
            </a>
          )}
          {job.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addressLine ?? job.address ?? "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
              data-testid={`hero-navigate-${job.id}`}
            >
              <MapPin size={16} className="text-blue-500" />
              Navigate
            </a>
          )}
        </div>
      )}

      {(job.beforePhotoUrl || job.afterPhotoUrl) && (
        <div className="flex gap-4 justify-center">
          {job.beforePhotoUrl && (
            <div className="text-center">
              <img
                src={resolveMediaUrl(job.beforePhotoUrl)}
                alt="Before"
                className="h-24 w-24 rounded-xl object-cover border border-border"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Before</p>
            </div>
          )}
          {job.afterPhotoUrl && (
            <div className="text-center">
              <img
                src={resolveMediaUrl(job.afterPhotoUrl)}
                alt="After"
                className="h-24 w-24 rounded-xl object-cover border border-border"
              />
              <p className="text-[10px] text-muted-foreground mt-1">After</p>
            </div>
          )}
        </div>
      )}

      {isOtherServiceJob(job) ? (
        <StaffServiceJobFlow job={job} {...actions} />
      ) : (
        <StaffJobActions job={job} {...actions} size="hero" />
      )}
    </section>
  );
}
