import { Phone, Navigation } from "lucide-react";
import { StaffJobActions } from "@/components/staff/StaffJobActions";
import { StaffServiceJobFlow } from "@/components/staff/StaffServiceJobFlow";
import { isOtherServiceJob } from "@/lib/staff-jobs";
import { resolveMediaUrl } from "@/lib/media-url";
import type { StaffJob } from "@/lib/staff-jobs";
import type { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { buildNavigateUrl, canNavigateTo } from "@/lib/maps";
import {
  StaffStatusBadge,
  StaffActionBar,
  StaffMapCard,
  StaffPhotoPair,
} from "@/features/staff-ds";

type Mutations = Pick<
  ReturnType<typeof useStaffJobsData>,
  | "transitionJob"
  | "uploadPhoto"
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

export function ActiveJobHero({ job, ...actions }: Props) {
  const isLive = job.status === "en_route" || job.status === "in_progress";
  const addressLine = job.area ? `${job.area}, ${job.address}` : job.address;

  return (
    <section
      className="staff-hero staff-dashboard-hero space-y-4 p-5"
      data-testid={`active-job-hero-${job.id}`}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {isLive ? "Active job" : "Next job"}
          </p>
          <h2 className="truncate font-display text-xl font-bold leading-tight text-foreground">
            {job.customerName}
          </h2>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {job.serviceType?.replace(/_/g, " ")}
            {job.serviceName ? ` · ${job.serviceName}` : ""}
            {job.scheduledTime ? ` · ${job.scheduledTime}` : ""}
          </p>
          {job.vehicleName && (
            <p className="mt-0.5 text-xs text-muted-foreground">{job.vehicleName}</p>
          )}
        </div>
        <StaffStatusBadge status={job.status ?? "scheduled"} pulse={isLive} className="shrink-0" />
      </div>

      {addressLine ? <StaffMapCard address={addressLine} /> : null}

      {isLive && (
        <p className="rounded-[var(--staff-radius-sm)] border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          GPS required for job updates. Start and complete only within 150m of the customer location.
        </p>
      )}

      {!isOtherServiceJob(job) && (
        <StaffActionBar>
          {job.customerPhone && (
            <a
              href={`tel:${job.customerPhone}`}
              className="staff-tap inline-flex items-center justify-center gap-2 rounded-[var(--staff-radius-sm)] border border-border bg-card text-sm font-semibold hover:bg-muted"
              data-testid={`hero-call-${job.id}`}
            >
              <Phone size={16} className="text-[hsl(var(--tone-success))]" aria-hidden />
              Call
            </a>
          )}
          {canNavigateTo(job) && (
            <a
              href={buildNavigateUrl(job)}
              target="_blank"
              rel="noreferrer"
              className="staff-tap inline-flex items-center justify-center gap-2 rounded-[var(--staff-radius-sm)] border border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10"
              data-testid={`hero-navigate-${job.id}`}
            >
              <Navigation size={16} aria-hidden />
              Navigate
            </a>
          )}
        </StaffActionBar>
      )}

      {(job.beforePhotoUrl || job.afterPhotoUrl) && (
        <StaffPhotoPair
          beforeUrl={job.beforePhotoUrl ? resolveMediaUrl(job.beforePhotoUrl) : null}
          afterUrl={job.afterPhotoUrl ? resolveMediaUrl(job.afterPhotoUrl) : null}
        />
      )}

      {isOtherServiceJob(job) ? (
        <StaffServiceJobFlow job={job} {...actions} />
      ) : (
        <StaffJobActions job={job} {...actions} size="hero" />
      )}
    </section>
  );
}
