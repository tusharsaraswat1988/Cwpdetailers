import { useAuth } from "@/lib/auth";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { ActiveJobHero } from "@/components/staff/ActiveJobHero";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Calendar, CheckCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function StaffDashboard() {
  const { user } = useAuth();
  const jobs = useStaffJobsData();

  const gate = (
    <StaffAccountGate
      scopeLoading={jobs.scopeLoading}
      missingStaffLink={jobs.missingStaffLink}
      staffId={jobs.staffId}
    >
      {null}
    </StaffAccountGate>
  );

  if (jobs.scopeLoading || jobs.missingStaffLink || jobs.staffId == null) {
    return gate;
  }

  const completedToday = jobs.today.filter(j => j.status === "completed").length;
  const mutations = {
    transitionMutation: jobs.transitionMutation,
    uploadPhoto: jobs.uploadPhoto,
    uploadingJobId: jobs.uploadingJobId,
    isActionPending: jobs.isActionPending,
  };

  return (
    <StaffAppShell>
      <div className="space-y-5 pb-2">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-display font-bold text-xl">
            Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {user?.name?.split(" ")[0]}
          </p>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </motion.div>

        <div className="flex gap-2" data-testid="staff-stats-row">
          {[
            { label: "Today", value: jobs.today.length, icon: Calendar, color: "text-primary" },
            { label: "Done", value: completedToday, icon: CheckCircle, color: "text-green-600" },
            { label: "Upcoming", value: jobs.upcoming.length, icon: Clock, color: "text-amber-500" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex-1 bg-card border border-border rounded-xl p-3 text-center"
              data-testid={`staff-stat-${s.label.toLowerCase()}`}
            >
              <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
              {jobs.loadingToday ? (
                <Skeleton className="h-5 w-8 mx-auto" />
              ) : (
                <p className={`font-display font-bold text-lg ${s.color}`}>{s.value}</p>
              )}
              <p className="text-muted-foreground text-[10px] mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {jobs.errorToday ? (
          <ErrorState onRetry={() => jobs.refetchToday()} />
        ) : jobs.loadingToday ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : jobs.activeJob ? (
          <ActiveJobHero job={jobs.activeJob} {...mutations} />
        ) : jobs.today.length === 0 ? (
          <EmptyState
            icon={<Calendar size={20} />}
            title="No jobs today"
            description="Check the Jobs tab for upcoming assignments"
            action={
              <Link href="/staff/jobs">
                <span className="text-sm text-primary font-medium">View all jobs →</span>
              </Link>
            }
          />
        ) : null}

        {jobs.remainingToday.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {jobs.activeJob ? "Up next today" : "Today's jobs"}
              </h2>
              <Link href="/staff/jobs" className="text-xs text-primary font-medium">
                See all
              </Link>
            </div>
            {jobs.remainingToday.map(job => (
              <StaffJobListItem key={job.id} job={job} compact linkToDashboard />
            ))}
          </section>
        )}
      </div>
    </StaffAppShell>
  );
}
