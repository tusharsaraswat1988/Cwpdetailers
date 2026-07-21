import { useState } from "react";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { Calendar } from "lucide-react";
import { formatJobDateHeader, groupJobsByDate, staffJobKey } from "@/lib/staff-jobs";
import {
  StaffPage,
  StaffHeader,
  StaffSkeleton,
  StaffEmptyState,
  StaffErrorState,
} from "@/features/staff-ds";

type Tab = "today" | "upcoming" | "done";

export default function StaffJobs() {
  const [tab, setTab] = useState<Tab>("today");
  const jobs = useStaffJobsData();

  if (jobs.scopeLoading || jobs.missingStaffLink || jobs.staffId == null) {
    return (
      <StaffAccountGate
        scopeLoading={jobs.scopeLoading}
        missingStaffLink={jobs.missingStaffLink}
        staffId={jobs.staffId}
      >
        {null}
      </StaffAccountGate>
    );
  }

  const isLoading = tab === "today" ? jobs.loadingToday : jobs.loadingAll;
  const isError = tab === "today" ? jobs.errorToday : jobs.errorAll;
  const refetch = tab === "today" ? jobs.refetchToday : jobs.refetchAll;

  const displayJobs = tab === "today" ? jobs.today : tab === "upcoming" ? jobs.upcoming : jobs.done;
  const grouped = tab === "today" ? null : groupJobsByDate(displayJobs);

  return (
    <StaffPage>
      <StaffHeader title="Assigned Jobs" subtitle="Tap a job to open actions" />

      <div
        className="flex gap-1 rounded-[var(--staff-radius)] bg-muted p-1"
        role="tablist"
        data-testid="jobs-segmented-control"
      >
        {(
          [
            ["today", `Today (${jobs.today.length})`],
            ["upcoming", `Upcoming (${jobs.upcoming.length})`],
            ["done", `Done (${jobs.done.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`staff-tap flex-1 rounded-[var(--staff-radius-sm)] px-2 py-2.5 text-xs font-semibold staff-transition sm:text-sm ${
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
            data-testid={`jobs-tab-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isError ? (
        <StaffErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <StaffSkeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : displayJobs.length === 0 ? (
        <StaffEmptyState
          icon={<Calendar size={20} aria-hidden />}
          title={
            tab === "today"
              ? "No jobs today"
              : tab === "upcoming"
                ? "No upcoming jobs"
                : "No completed jobs yet"
          }
          description={
            tab === "today" ? "Your manager will assign today's schedule here" : undefined
          }
        />
      ) : tab === "today" ? (
        <div className="space-y-3">
          {jobs.today.map(job => (
            <StaffJobListItem key={staffJobKey(job)} job={job} linkToDashboard />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped?.map(({ dateKey, jobs: dayJobs }) => (
            <div key={dateKey}>
              <div className="mb-2 flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {formatJobDateHeader(dateKey)}
                </p>
                <div className="h-px flex-1 bg-border" />
                <p className="text-xs text-muted-foreground">
                  {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="space-y-3">
                {dayJobs.map(job => (
                  <StaffJobListItem
                    key={staffJobKey(job)}
                    job={job}
                    compact={tab === "done"}
                    linkToDashboard={tab !== "done"}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </StaffPage>
  );
}
