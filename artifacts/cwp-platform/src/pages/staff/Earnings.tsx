import { useMemo, useState } from "react";
import {
  useGetStaffLeaderboard,
  getGetStaffLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { IndianRupee, Trophy, TrendingUp } from "lucide-react";
import { groupJobsByDate, jobAmount, todayIso, type StaffJob } from "@/lib/staff-jobs";

type Period = "today" | "week" | "month";

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function inPeriod(job: StaffJob, period: Period, now: Date) {
  if (job.status !== "completed" || !job.scheduledDate) return false;
  const jobDate = new Date(job.scheduledDate + "T12:00:00");
  if (period === "today") return job.scheduledDate === todayIso();
  if (period === "week") {
    const weekStart = startOfWeek(now);
    return jobDate >= weekStart && jobDate <= now;
  }
  const monthPrefix = now.toISOString().slice(0, 7);
  return job.scheduledDate.startsWith(monthPrefix);
}

export default function StaffEarnings() {
  const [period, setPeriod] = useState<Period>("today");
  const jobs = useStaffJobsData();
  const now = new Date();
  const month = now.toISOString().slice(0, 7);

  const { data: leaderboard } = useGetStaffLeaderboard(
    { month },
    { query: { queryKey: getGetStaffLeaderboardQueryKey({ month }) } },
  );

  const completedJobs = useMemo(
    () => jobs.all.filter(j => j.status === "completed"),
    [jobs.all],
  );

  const periodJobs = useMemo(
    () => completedJobs.filter(j => inPeriod(j, period, now)),
    [completedJobs, period, now],
  );

  const totalEarnings = periodJobs.reduce((sum, j) => sum + jobAmount(j), 0);
  const myRank =
    jobs.staffId != null ? (leaderboard ?? []).findIndex(s => s.staffId === jobs.staffId) + 1 : 0;

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

  const grouped = groupJobsByDate(
    [...periodJobs].sort((a, b) => (b.scheduledDate ?? "").localeCompare(a.scheduledDate ?? "")),
  );

  return (
    <StaffAppShell>
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-xl">Earnings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">From completed jobs</p>
        </div>

        <div className="flex rounded-xl bg-muted p-1 gap-1" data-testid="earnings-period-control">
          {(
            [
              ["today", "Today"],
              ["week", "This week"],
              ["month", "This month"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                period === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
              data-testid={`earnings-period-${key}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className="rounded-2xl bg-gradient-to-br from-primary/10 to-card border border-primary/20 p-6 text-center"
          data-testid="earnings-total"
        >
          <IndianRupee size={20} className="mx-auto text-primary mb-2" />
          {jobs.loadingAll ? (
            <Skeleton className="h-10 w-32 mx-auto" />
          ) : (
            <p className="font-display font-bold text-4xl text-primary">
              ₹{totalEarnings.toLocaleString("en-IN")}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {periodJobs.length} completed job{periodJobs.length !== 1 ? "s" : ""}
          </p>
        </div>

        {period === "week" && myRank > 0 && (
          <div
            className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
            data-testid="earnings-rank"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Your rank this month</p>
              <p className="font-display font-bold text-xl text-primary">#{myRank}</p>
            </div>
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <TrendingUp size={14} />
            Job breakdown
          </h2>

          {jobs.loadingAll ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : periodJobs.length === 0 ? (
            <EmptyState
              icon={<IndianRupee size={20} />}
              title="No earnings yet"
              description="Complete jobs to see earnings here"
            />
          ) : (
            grouped.map(({ dateKey, jobs: dayJobs }) => (
              <div key={dateKey}>
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">
                  {dateKey === todayIso() ? "Today" : dateKey}
                </p>
                <div className="space-y-2">
                  {dayJobs.map(job => (
                    <StaffJobListItem key={job.id} job={job} compact showAmount />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </StaffAppShell>
  );
}
