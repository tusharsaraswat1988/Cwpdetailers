import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Link } from "wouter";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { useStaffDailyRoute } from "@/features/daily-cleaning/api";
import { staffJobKey } from "@/lib/staff-jobs";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";
import { StaffPushPrompt } from "@/components/staff/StaffPushPrompt";
import { StaffVerificationBanner } from "@/features/staff/components/StaffVerificationBanner";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { ActiveJobHero } from "@/components/staff/ActiveJobHero";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { Calendar, CheckCircle, Clock, Sparkles, Wrench, ChevronRight } from "lucide-react";
import {
  StaffPage,
  StaffDashboard,
  StaffMetric,
  StaffSkeleton,
  StaffErrorState,
  StaffCard,
} from "@/features/staff-ds";

function DashboardSection({
  title,
  icon: Icon,
  href,
  stats,
  loading,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  href: string;
  stats: { label: string; value: number; tone?: "primary" | "success" | "warning" }[];
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="staff-card staff-elevated overflow-hidden" data-testid="staff-dashboard-section">
      <Link
        href={href}
        className="staff-tap flex items-center justify-between gap-3 border-b border-border p-4 hover:bg-muted/30"
      >
        <div className="flex items-center gap-2.5">
          <div className="staff-icon-well flex h-10 w-10 items-center justify-center rounded-xl">
            <Icon size={18} aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <div className="mt-1 flex gap-3">
              {stats.map(s => (
                <span key={s.label} className="text-[10px] text-muted-foreground">
                  {loading ? (
                    "…"
                  ) : (
                    <>
                      <span
                        className={
                          s.tone === "success"
                            ? "font-bold text-[hsl(var(--tone-success-fg))]"
                            : s.tone === "warning"
                              ? "font-bold text-[hsl(var(--tone-warning-fg))]"
                              : "font-bold text-primary"
                        }
                      >
                        {s.value}
                      </span>{" "}
                      {s.label}
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {children ? <div className="space-y-3 p-4 pt-3">{children}</div> : null}
    </section>
  );
}

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const jobs = useStaffJobsData();
  const { data: routeData, isLoading: loadingRoute } = useStaffDailyRoute();

  const { data: myContext } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"],
    queryFn: staffEcosystemApi.getMyContext,
    enabled: Boolean(user?.staffId),
  });

  const { data: myProfile } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-profile"],
    queryFn: staffEcosystemApi.getMyProfile,
    enabled: Boolean(user?.staffId),
  });

  const { data: myRoles } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "my-roles"],
    queryFn: staffEcosystemApi.getMyOperationalRoles,
    enabled: Boolean(user?.staffId),
  });

  const canDailyClean = myRoles?.slugs.includes(OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER) ?? false;

  if (myContext?.staffCategory === "supervisor") {
    return <Redirect to="/staff/profile" />;
  }

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

  const routeStops = (routeData?.stops ?? []) as { todayStatus?: string }[];
  const dailyPending = routeStops.filter(s => s.todayStatus === "pending").length;
  const dailyDone = routeStops.filter(s => s.todayStatus === "completed").length;

  const otherToday = jobs.today;
  const otherCompleted = otherToday.filter(j => j.status === "completed").length;
  const otherPending = otherToday.filter(j => j.status !== "completed" && j.status !== "cancelled").length;

  const completedToday = canDailyClean ? dailyDone : otherCompleted;
  const totalToday = canDailyClean ? routeStops.length : otherToday.length;
  const pendingToday = canDailyClean ? dailyPending : otherPending;

  const mutations = {
    transitionJob: jobs.transitionJob,
    uploadGeoPhoto: jobs.uploadGeoPhoto,
    completeJobWithNotes: jobs.completeJobWithNotes,
    uploadPhoto: jobs.uploadPhoto,
    uploadingJobId: jobs.uploadingJobId,
    uploadingPhotoIndex: jobs.uploadingPhotoIndex,
    locatingJobId: jobs.locatingJobId,
    isActionPending: jobs.isActionPending,
  };

  const hour = new Date().getHours();
  const greeting = `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${user?.name?.split(" ")[0] ?? "there"}`;
  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <StaffPage className="pb-2">
      <StaffPushPrompt />

      {myProfile && (
        <StaffVerificationBanner status={myProfile.verificationStatus} notes={myProfile.verificationNotes} />
      )}

      <StaffDashboard greeting={greeting} dateLabel={dateLabel} />

      <div className="flex gap-2" data-testid="staff-stats-row">
        <StaffMetric
          label="Assigned"
          value={jobs.loadingToday || loadingRoute ? "…" : totalToday}
          icon={<Calendar size={14} aria-hidden />}
          tone="primary"
        />
        <StaffMetric
          label="Done"
          value={jobs.loadingToday || loadingRoute ? "…" : completedToday}
          icon={<CheckCircle size={14} aria-hidden />}
          tone="success"
        />
        <StaffMetric
          label="Pending"
          value={jobs.loadingToday || loadingRoute ? "…" : pendingToday}
          icon={<Clock size={14} aria-hidden />}
          tone="warning"
        />
      </div>

      {canDailyClean && (
        <DashboardSection
          title="Daily Car Cleaning"
          icon={Sparkles}
          href="/staff/daily-clean"
          loading={loadingRoute}
          stats={[
            { label: "route", value: routeStops.length, tone: "primary" },
            { label: "done", value: dailyDone, tone: "success" },
            { label: "pending", value: dailyPending, tone: "warning" },
          ]}
        >
          {loadingRoute ? (
            <StaffSkeleton className="h-12 w-full" />
          ) : routeStops.length === 0 ? (
            <p className="text-xs text-muted-foreground">No daily clean assignment today</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {dailyPending > 0
                ? `${dailyPending} vehicle${dailyPending !== 1 ? "s" : ""} pending — plate scan + photo upload`
                : "All daily cleaning complete for today"}
            </p>
          )}
        </DashboardSection>
      )}

      {canDailyClean && otherToday.length > 0 && (
        <DashboardSection
          title="My Bookings"
          icon={Wrench}
          href="/staff/bookings"
          loading={jobs.loadingToday}
          stats={[
            { label: "today", value: otherToday.length, tone: "primary" },
            { label: "done", value: otherCompleted, tone: "success" },
            { label: "pending", value: otherPending, tone: "warning" },
          ]}
        >
          <p className="text-xs text-muted-foreground">
            {otherPending > 0
              ? `${otherPending} car wash / service job pending`
              : "All service bookings complete"}
          </p>
        </DashboardSection>
      )}

      {!canDailyClean && (
        <DashboardSection
          title="Other Services"
          icon={Wrench}
          href="/staff/bookings"
          loading={jobs.loadingToday}
          stats={[
            { label: "today", value: otherToday.length, tone: "primary" },
            { label: "done", value: otherCompleted, tone: "success" },
            { label: "pending", value: otherPending, tone: "warning" },
          ]}
        >
          {jobs.errorToday ? (
            <StaffErrorState onRetry={() => jobs.refetchToday()} />
          ) : jobs.loadingToday ? (
            <StaffSkeleton className="h-12 w-full" />
          ) : otherToday.length === 0 ? (
            <p className="text-xs text-muted-foreground">No car wash / service jobs today</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {otherPending > 0
                ? `${otherPending} job pending — navigate, check in, photos, complete`
                : "All service jobs complete"}
            </p>
          )}
        </DashboardSection>
      )}

      {!canDailyClean && jobs.errorToday ? null : !canDailyClean && jobs.loadingToday ? (
        <StaffSkeleton className="h-64 w-full rounded-[var(--staff-radius-xl)]" />
      ) : jobs.activeJob ? (
        <ActiveJobHero job={jobs.activeJob} {...mutations} />
      ) : !canDailyClean ? (
        <StaffCard>
          <p className="text-sm font-medium text-foreground">No active job</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When a job is assigned, it will appear here with Navigate and Start actions.
          </p>
        </StaffCard>
      ) : null}

      {!canDailyClean && jobs.remainingToday.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Other services today
          </h2>
          {jobs.remainingToday.slice(0, 3).map(job => (
            <Link
              key={staffJobKey(job)}
              href={`/staff/bookings?job=${staffJobKey(job)}`}
              className="block"
            >
              <StaffJobListItem job={job} compact />
            </Link>
          ))}
        </section>
      )}
    </StaffPage>
  );
}
