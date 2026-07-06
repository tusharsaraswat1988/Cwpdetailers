import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Link } from "wouter";
import { useStaffJobsData } from "@/hooks/useStaffJobsData";
import { useStaffDailyRoute } from "@/features/daily-cleaning/api";
import { staffJobKey } from "@/lib/staff-jobs";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";
import { StaffPushPrompt } from "@/components/staff/StaffPushPrompt";
import { StaffVerificationBanner } from "@/features/staff/components/StaffVerificationBanner";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { ActiveJobHero } from "@/components/staff/ActiveJobHero";
import { StaffJobListItem } from "@/components/staff/StaffJobListItem";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Calendar, CheckCircle, Clock, Sparkles, Wrench, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

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
  stats: { label: string; value: number; color: string }[];
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <Link href={href} className="flex items-center justify-between gap-3 p-4 border-b border-border hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-sm">{title}</h2>
            <div className="flex gap-3 mt-1">
              {stats.map(s => (
                <span key={s.label} className="text-[10px] text-muted-foreground">
                  {loading ? "…" : (
                    <>
                      <span className={`font-bold ${s.color}`}>{s.value}</span> {s.label}
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
        <ChevronRight size={18} className="text-muted-foreground shrink-0" />
      </Link>
      {children && <div className="p-4 pt-3 space-y-3">{children}</div>}
    </section>
  );
}

export default function StaffDashboard() {
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

  const routeStops = routeData?.stops ?? [];
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
    uploadPhoto: jobs.uploadPhoto,
    uploadingJobId: jobs.uploadingJobId,
    uploadingPhotoIndex: jobs.uploadingPhotoIndex,
    locatingJobId: jobs.locatingJobId,
    isActionPending: jobs.isActionPending,
  };

  return (
    <StaffAppShell>
      <div className="space-y-5 pb-2">
        <StaffPushPrompt />

        {myProfile && (
          <StaffVerificationBanner status={myProfile.verificationStatus} notes={myProfile.verificationNotes} />
        )}

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
            { label: "Assigned", value: totalToday, icon: Calendar, color: "text-primary" },
            { label: "Done", value: completedToday, icon: CheckCircle, color: "text-green-600" },
            { label: "Pending", value: pendingToday, icon: Clock, color: "text-amber-500" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex-1 bg-card border border-border rounded-xl p-3 text-center"
            >
              <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
              {jobs.loadingToday || loadingRoute ? (
                <Skeleton className="h-5 w-8 mx-auto" />
              ) : (
                <p className={`font-display font-bold text-lg ${s.color}`}>{s.value}</p>
              )}
              <p className="text-muted-foreground text-[10px] mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {canDailyClean && (
          <DashboardSection
            title="Daily Car Cleaning"
            icon={Sparkles}
            href="/staff/daily-clean"
            loading={loadingRoute}
            stats={[
              { label: "route", value: routeStops.length, color: "text-primary" },
              { label: "done", value: dailyDone, color: "text-green-600" },
              { label: "pending", value: dailyPending, color: "text-amber-500" },
            ]}
          >
            {loadingRoute ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : routeStops.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aaj koi daily clean assignment nahi</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {dailyPending > 0
                  ? `${dailyPending} vehicle${dailyPending !== 1 ? "s" : ""} pending — plate scan + photo upload`
                  : "Aaj ki saari daily cleaning complete ho chuki hai"}
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
              { label: "today", value: otherToday.length, color: "text-primary" },
              { label: "done", value: otherCompleted, color: "text-green-600" },
              { label: "pending", value: otherPending, color: "text-amber-500" },
            ]}
          >
            <p className="text-xs text-muted-foreground">
              {otherPending > 0
                ? `${otherPending} car wash / service job pending`
                : "Aaj ki saari service bookings complete"}
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
            { label: "today", value: otherToday.length, color: "text-primary" },
            { label: "done", value: otherCompleted, color: "text-green-600" },
            { label: "pending", value: otherPending, color: "text-amber-500" },
          ]}
        >
          {jobs.errorToday ? (
            <ErrorState onRetry={() => jobs.refetchToday()} />
          ) : jobs.loadingToday ? (
            <Skeleton className="h-12 w-full rounded-lg" />
          ) : otherToday.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aaj koi car wash / service job nahi</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {otherPending > 0
                ? `${otherPending} job pending — start, 3 before + 3 after photos, close`
                : "Aaj ki saari service jobs complete"}
            </p>
          )}
        </DashboardSection>
        )}

        {!canDailyClean && jobs.errorToday ? null : !canDailyClean && jobs.loadingToday ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : jobs.activeJob ? (
          <ActiveJobHero job={jobs.activeJob} {...mutations} />
        ) : null}

        {!canDailyClean && jobs.remainingToday.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Other services today
            </h2>
            {jobs.remainingToday.slice(0, 3).map(job => (
              <Link key={staffJobKey(job)} href={`/staff/bookings?job=${staffJobKey(job)}`} className="block">
                <StaffJobListItem job={job} compact />
              </Link>
            ))}
          </section>
        )}
      </div>
    </StaffAppShell>
  );
}
