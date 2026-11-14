import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useGetStaffAttendance, getGetStaffAttendanceQueryKey } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { markAttendanceWithLocation } from "@/lib/location";
import { captureStaffPhoto, isCameraCancel } from "@/lib/native/captureStaffPhoto";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
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
import { NextTaskCard, type NextTaskData } from "@/components/staff/NextTaskCard";
import { StaffExecutionActionsSheet } from "@/features/daily-cleaning/components/StaffExecutionActionsSheet";
import {
  StaffVehicleCleanDialog,
  type CleanDialogStop,
} from "@/features/daily-cleaning/components/StaffVehicleCleanDialog";
import {
  getDcmsDayStore,
  saveDcmsLocalRecord,
  localStatusToRouteStopStatus,
  type DcmsLocalRecord,
} from "@/features/daily-cleaning/lib/dcmsLocalStorage";
import {
  Calendar,
  CheckCircle,
  Clock,
  Sparkles,
  Wrench,
  ChevronRight,
  Camera,
  Loader2,
  Navigation,
  Search,
  ListOrdered,
  AlertTriangle,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const { data: routeData, isLoading: loadingRoute, refetch: refetchRoute } = useStaffDailyRoute();

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

  const todayIsoDate = new Date().toISOString().split("T")[0];
  const { data: attendanceData } = useGetStaffAttendance(
    user?.staffId ?? 0,
    { month: todayIsoDate.slice(0, 7) },
    { query: { enabled: Boolean(user?.staffId) } }
  );
  const todayAttendance = (attendanceData ?? []).find((a: { date?: string }) => a.date === todayIsoDate);
  const isCheckedIn = Boolean(
    todayAttendance &&
      (todayAttendance.status === "present" ||
        todayAttendance.status === "half_day" ||
        todayAttendance.status === "late" ||
        todayAttendance.status === "checked_in")
  );

  const canDailyClean = myRoles?.slugs.includes(OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER) ?? false;

  // Local storage optimistic records
  const staffId = user?.staffId ?? null;
  const [localRecords, setLocalRecords] = useState<Record<number, DcmsLocalRecord>>({});

  useEffect(() => {
    if (staffId) {
      const store = getDcmsDayStore(staffId);
      setLocalRecords(store.records);
    }
  }, [staffId]);

  // Modals for next task action on dashboard
  const [selectedCleanStop, setSelectedCleanStop] = useState<CleanDialogStop | null>(null);
  const [selectedActionStop, setSelectedActionStop] = useState<CleanDialogStop | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  const markMutation = useMutation({
    mutationFn: (payload: {
      date: string;
      status: string;
      checkInTime?: string;
      imageBase64: string;
      exif?: Record<string, unknown> | null;
      capturedAt?: string;
    }) => markAttendanceWithLocation(user?.staffId ?? jobs.staffId!, payload),
    onSuccess: (data) => {
      const activeStaffId = user?.staffId ?? jobs.staffId;
      if (activeStaffId != null) {
        qc.invalidateQueries({ queryKey: getGetStaffAttendanceQueryKey(activeStaffId) });
      }
      if (isOfflineQueued(data)) {
        toast({
          title: "Check-in saved on phone",
          description: queuedSavedMessage("punch"),
        });
        return;
      }
      toast({ title: "Attendance marked", description: "Selfie and GPS recorded for shift check-in" });
    },
  });

  async function handleAttendanceCheckIn() {
    const activeStaffId = user?.staffId ?? jobs.staffId;
    if (!activeStaffId) return;
    try {
      const photo = await captureStaffPhoto("front");
      await markMutation.mutateAsync({
        date: todayIsoDate,
        status: "present",
        checkInTime: new Date().toTimeString().slice(0, 5),
        imageBase64: photo.dataUrl,
        exif: photo.exif,
        capturedAt: photo.capturedAt,
      });
    } catch (err) {
      if (isCameraCancel(err)) return;
      toast({
        title: "Check-in failed",
        description: err instanceof Error ? err.message : "Selfie capture failed",
        variant: "destructive",
      });
    }
  }

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

  // Merge server route stops with local storage records
  const rawRouteStops = (routeData?.stops ?? []) as Array<{
    subscriptionId: number;
    customerId?: number;
    vehicleId?: number;
    customerName: string;
    vehicleNumber: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleColor?: string | null;
    todayStatus: "pending" | "completed" | "missed" | "rejected" | "car_not_available";
    remainingCleanings: number;
    address?: string | null;
    location?: { latitude: number; longitude: number } | null;
    societyName?: string | null;
    towerName?: string | null;
    flatNumber?: string | null;
    parkingLevel?: string | null;
    parkingBay?: string | null;
    parkingNotes?: string | null;
  }>;

  const routeStops = rawRouteStops.map(s => {
    const local = localRecords[s.subscriptionId];
    if (!local) return s;
    return {
      ...s,
      todayStatus: localStatusToRouteStopStatus(local.status),
    };
  });

  const dailyPending = routeStops.filter(s => s.todayStatus === "pending" || s.todayStatus === "rejected").length;
  const dailyDone = routeStops.filter(s => s.todayStatus === "completed").length;
  const dailyUnavailable = routeStops.filter(s => s.todayStatus === "car_not_available").length;

  const otherToday = jobs.today;
  const otherCompleted = otherToday.filter(j => j.status === "completed").length;
  const otherPending = otherToday.filter(j => j.status !== "completed" && j.status !== "cancelled").length;

  const completedToday = canDailyClean ? dailyDone : otherCompleted;
  const totalToday = canDailyClean ? routeStops.length : otherToday.length;
  const pendingToday = canDailyClean ? dailyPending : otherPending;
  const skippedToday = canDailyClean ? dailyUnavailable : otherToday.filter(j => j.status === "cancelled").length;

  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  // DERIVE NEXT TASK FOR HERO CARD
  const nextDailyStop = canDailyClean
    ? routeStops.find(s => s.todayStatus === "pending" || s.todayStatus === "rejected")
    : null;

  const nextBookingJob = !canDailyClean || (dailyPending === 0 && otherPending > 0)
    ? jobs.today.find(j => j.status !== "completed" && j.status !== "cancelled")
    : null;

  const nextTask: NextTaskData | null = useMemo(() => {
    if (nextDailyStop) {
      return {
        type: "daily_clean",
        id: nextDailyStop.subscriptionId,
        subscriptionId: nextDailyStop.subscriptionId,
        customerName: nextDailyStop.customerName,
        vehicleNumber: nextDailyStop.vehicleNumber,
        vehicleMake: nextDailyStop.vehicleMake,
        vehicleModel: nextDailyStop.vehicleModel,
        vehicleColor: nextDailyStop.vehicleColor,
        societyName: nextDailyStop.societyName,
        towerName: nextDailyStop.towerName,
        flatNumber: nextDailyStop.flatNumber,
        parkingLevel: nextDailyStop.parkingLevel,
        parkingBay: nextDailyStop.parkingBay,
        address: nextDailyStop.address,
        location: nextDailyStop.location,
        notes: nextDailyStop.parkingNotes,
      };
    }

    if (nextBookingJob) {
      return {
        type: "booking",
        id: nextBookingJob.id,
        customerName: nextBookingJob.customerName ?? "Customer",
        customerPhone: nextBookingJob.customerPhone,
        vehicleNumber: nextBookingJob.vehicleName,
        serviceName: nextBookingJob.serviceName ?? nextBookingJob.serviceType,
        scheduledTime: nextBookingJob.scheduledTime,
        address: nextBookingJob.address,
        location:
          nextBookingJob.locationLat && nextBookingJob.locationLng
            ? { latitude: nextBookingJob.locationLat, longitude: nextBookingJob.locationLng }
            : null,
        status: nextBookingJob.status,
      };
    }

    return null;
  }, [nextDailyStop, nextBookingJob]);

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

  const handleNextTaskAction = () => {
    if (!nextTask) return;
    if (nextTask.type === "daily_clean" && nextDailyStop) {
      setSelectedActionStop({
        subscriptionId: nextDailyStop.subscriptionId,
        customerId: nextDailyStop.customerId,
        vehicleId: nextDailyStop.vehicleId,
        customerName: nextDailyStop.customerName,
        vehicleNumber: nextDailyStop.vehicleNumber,
        vehicleMake: nextDailyStop.vehicleMake,
        vehicleModel: nextDailyStop.vehicleModel,
        vehicleColor: nextDailyStop.vehicleColor,
        todayStatus: nextDailyStop.todayStatus,
        remainingCleanings: nextDailyStop.remainingCleanings,
      });
    }
  };

  const handleSuccessfulClean = () => {
    if (staffId && selectedCleanStop) {
      saveDcmsLocalRecord(staffId, {
        subscriptionId: selectedCleanStop.subscriptionId,
        vehicleNumber: selectedCleanStop.vehicleNumber,
        status: "completed",
        actionLabel: "Car Found — Cleaning Completed",
      });
      const store = getDcmsDayStore(staffId);
      setLocalRecords(store.records);
    }
    void refetchRoute();
  };

  const handleSuccessfulException = () => {
    if (staffId) {
      const store = getDcmsDayStore(staffId);
      setLocalRecords(store.records);
    }
    void refetchRoute();
  };

  return (
    <StaffPage className="pb-6 space-y-4">
      <StaffPushPrompt />

      {myProfile && (
        <StaffVerificationBanner status={myProfile.verificationStatus} notes={myProfile.verificationNotes} />
      )}

      {/* DASHBOARD TOP HEADER & SHIFT ATTENDANCE */}
      <StaffDashboard greeting={greeting} dateLabel={dateLabel}>
        <div className="mt-3 rounded-xl border border-border bg-card p-3 shadow-none staff-elevated">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isCheckedIn
                    ? "bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))]"
                    : "bg-amber-500/15 text-amber-800"
                )}
              >
                {isCheckedIn ? <CheckCircle size={18} /> : <Clock size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Today's Shift Attendance
                </p>
                <p className="text-sm font-semibold truncate text-foreground">
                  {isCheckedIn
                    ? `Checked In${todayAttendance?.checkInTime ? ` at ${todayAttendance.checkInTime}` : ""}`
                    : "Not Checked In"}
                </p>
              </div>
            </div>
            {!isCheckedIn ? (
              <button
                type="button"
                onClick={() => void handleAttendanceCheckIn()}
                disabled={markMutation.isPending}
                className="staff-tap shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-70"
                data-testid="staff-check-in-btn"
              >
                {markMutation.isPending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Checking in…
                  </>
                ) : (
                  <>
                    <Camera size={12} />
                    Check in
                  </>
                )}
              </button>
            ) : (
              <span className="shrink-0 text-xs font-medium text-[hsl(var(--tone-success-fg))]">
                Verified
              </span>
            )}
          </div>
        </div>
      </StaffDashboard>

      {/* DAILY PROGRESS SECTION WITH VISUAL PROGRESS BAR */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3 staff-elevated" data-testid="staff-daily-progress-section">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Daily Task Progress</span>
          <span className="font-bold text-foreground">
            {completedToday} of {totalToday} Tasks Done ({progressPercent}%)
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center pt-1" data-testid="staff-stats-row">
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight truncate">Assigned</p>
            <p className="text-base sm:text-lg font-bold font-display text-foreground mt-0.5">
              {jobs.loadingToday || loadingRoute ? "…" : totalToday}
            </p>
          </div>
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-2">
            <p className="text-[10px] text-green-800 dark:text-green-300 font-semibold uppercase tracking-tight truncate">Done</p>
            <p className="text-base sm:text-lg font-bold font-display text-green-700 dark:text-green-300 mt-0.5">
              {jobs.loadingToday || loadingRoute ? "…" : completedToday}
            </p>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2">
            <p className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold uppercase tracking-tight truncate">Pending</p>
            <p className="text-base sm:text-lg font-bold font-display text-amber-700 dark:text-amber-300 mt-0.5">
              {jobs.loadingToday || loadingRoute ? "…" : pendingToday}
            </p>
          </div>
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-2">
            <p className="text-[10px] text-orange-800 dark:text-orange-300 font-semibold uppercase tracking-tight truncate">Skipped</p>
            <p className="text-base sm:text-lg font-bold font-display text-orange-700 dark:text-orange-300 mt-0.5">
              {jobs.loadingToday || loadingRoute ? "…" : skippedToday}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" data-testid="staff-quick-actions">
        {canDailyClean && (
          <Link
            href="/staff/daily-clean"
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl border border-border bg-card font-semibold text-foreground hover:bg-muted/50 transition-colors shadow-none"
            data-testid="quick-action-route"
          >
            <ListOrdered size={15} className="text-primary" />
            <span>My Route ({dailyPending})</span>
          </Link>
        )}

        {canDailyClean && (
          <Link
            href="/staff/daily-clean"
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl border border-border bg-card font-semibold text-foreground hover:bg-muted/50 transition-colors shadow-none"
            data-testid="quick-action-search"
          >
            <Search size={15} className="text-primary" />
            <span>Search Car</span>
          </Link>
        )}

        {otherToday.length > 0 && (
          <Link
            href="/staff/bookings"
            className="flex items-center justify-center gap-1.5 p-3 rounded-xl border border-border bg-card font-semibold text-foreground hover:bg-muted/50 transition-colors shadow-none"
            data-testid="quick-action-bookings"
          >
            <Wrench size={15} className="text-primary" />
            <span>Bookings ({otherPending})</span>
          </Link>
        )}

        <Link
          href="/staff/profile"
          className="flex items-center justify-center gap-1.5 p-3 rounded-xl border border-border bg-card font-semibold text-foreground hover:bg-muted/50 transition-colors shadow-none"
          data-testid="quick-action-profile"
        >
          <Calendar size={15} className="text-primary" />
          <span>My Shifts</span>
        </Link>
      </div>

      {/* NEXT TASK HERO CARD (WHAT SHOULD I DO NEXT?) */}
      {nextTask ? (
        <div className="space-y-1.5">
          <NextTaskCard
            task={nextTask}
            onAction={nextTask.type === "daily_clean" ? handleNextTaskAction : undefined}
            actionLabel={nextTask.type === "daily_clean" ? "Action Karein" : "Start Service"}
          />
        </div>
      ) : totalToday > 0 && pendingToday === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
            All Tasks Complete for Today!
          </h3>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
            Great job! You have completed all assigned {totalToday} vehicle tasks today.
          </p>
        </div>
      ) : null}

      {/* DETAILED SERVICE SECTIONS */}
      {canDailyClean && (
        <DashboardSection
          title="Daily Car Cleaning"
          icon={Sparkles}
          href="/staff/daily-clean"
          loading={loadingRoute}
          stats={[
            { label: "route", value: routeStops.length, tone: "primary" },
            { label: "done", value: dailyDone, tone: "success" },
            { label: "car n/a", value: dailyUnavailable, tone: "warning" },
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
                ? `${dailyPending} vehicle${dailyPending !== 1 ? "s" : ""} pending`
                : dailyUnavailable > 0
                  ? `Route complete — ${dailyDone} cleaned, ${dailyUnavailable} car not available`
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

      {!canDailyClean && jobs.activeJob && (
        <ActiveJobHero job={jobs.activeJob} {...mutations} />
      )}

      {/* CONTEXTUAL ACTION MODALS MOUNTED ON DASHBOARD */}
      <StaffExecutionActionsSheet
        open={Boolean(selectedActionStop)}
        onOpenChange={(open) => {
          if (!open) setSelectedActionStop(null);
        }}
        stop={selectedActionStop}
        staffId={staffId}
        onStartClean={(targetStop) => {
          setSelectedCleanStop(targetStop);
        }}
        onSuccess={handleSuccessfulException}
      />

      <StaffVehicleCleanDialog
        open={Boolean(selectedCleanStop)}
        onOpenChange={(open) => {
          if (!open) setSelectedCleanStop(null);
        }}
        stop={selectedCleanStop}
        visitType="cleaning"
        onSuccess={handleSuccessfulClean}
      />
    </StaffPage>
  );
}
