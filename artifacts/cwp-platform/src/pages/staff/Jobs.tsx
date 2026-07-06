import { useState } from "react";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Calendar } from "lucide-react";
import { formatJobDateHeader, groupJobsByDate, staffJobKey } from "@/lib/staff-jobs";

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
    <StaffAppShell>
      <div className="space-y-4">
        <div>
          <h1 className="font-display font-bold text-xl">All Jobs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Tap a job to open actions on Today</p>
        </div>

        <div
          className="flex rounded-xl bg-muted p-1 gap-1"
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
              className={`flex-1 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
              data-testid={`jobs-tab-${key}`}
            >
              {label}
            </button>
          ))}
        </div>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : displayJobs.length === 0 ? (
          <EmptyState
            icon={<Calendar size={20} />}
            title={
              tab === "today"
                ? "No jobs today"
                : tab === "upcoming"
                  ? "No upcoming jobs"
                  : "No completed jobs yet"
            }
            description={
              tab === "today"
                ? "Your manager will assign today's schedule here"
                : undefined
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
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {formatJobDateHeader(dateKey)}
                  </p>
                  <div className="flex-1 h-px bg-border" />
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
      </div>
    </StaffAppShell>
  );
}
