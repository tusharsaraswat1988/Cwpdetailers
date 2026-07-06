import { Link } from "wouter";
import { MapPin, Phone, ChevronRight, Navigation } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { StaffJob } from "@/lib/staff-jobs";
import { jobAmount } from "@/lib/staff-jobs";
import { buildNavigateUrl } from "@/features/master-data/api";

interface Props {
  job: StaffJob;
  compact?: boolean;
  showAmount?: boolean;
  linkToDashboard?: boolean;
}

export function StaffJobListItem({ job, compact, showAmount, linkToDashboard }: Props) {
  const content = (
    <div
      className={`bg-card border border-border rounded-xl p-4 ${linkToDashboard ? "hover:border-primary/40 transition-colors" : ""}`}
      data-testid={`job-list-item-${job.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`font-semibold truncate ${compact ? "text-sm" : "text-base"}`}>{job.customerName}</p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {(job.serviceName ?? job.serviceType)?.replace(/_/g, " ")}
            {job.scheduledTime ? ` · ${job.scheduledTime}` : ""}
          </p>
          {(job.address || job.area) && !compact && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{job.area ? `${job.area}, ${job.address}` : job.address}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={job.status ?? "scheduled"} />
          {showAmount && job.status === "completed" && jobAmount(job) > 0 && (
            <p className="text-sm font-semibold text-primary">₹{jobAmount(job).toLocaleString("en-IN")}</p>
          )}
          {linkToDashboard && (
            <ChevronRight size={16} className="text-muted-foreground mt-1" />
          )}
        </div>
      </div>

      {!compact && (job.customerPhone || job.address) && (
        <div className="flex gap-2 mt-3">
          {job.customerPhone && (
            <a
              href={`tel:${job.customerPhone}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Phone size={12} className="text-green-600" />
              Call
            </a>
          )}
          {(job.address || job.locationLat) && (
            <a
              href={buildNavigateUrl(job)}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs text-primary font-medium hover:bg-primary/10 transition-colors"
              data-testid={`btn-navigate-${job.id}`}
            >
              <Navigation size={12} />
              Navigate
            </a>
          )}
        </div>
      )}
    </div>
  );

  if (linkToDashboard) {
    return (
      <Link href="/staff/dashboard" className="block">
        {content}
      </Link>
    );
  }

  return content;
}
