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
import { staffJobKey } from "@/lib/staff-jobs";
import { useStaffDailyRoute } from "@/features/daily-cleaning/api";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";
import { StaffPushPrompt } from "@/components/staff/StaffPushPrompt";
import { StaffVerificationBanner } from "@/features/staff/components/StaffVerificationBanner";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
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
  CheckCircle,
  Clock,
  Sparkles,
  Wrench,
  ChevronRight,
  Camera,
  Loader2,
  CheckCircle2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StaffPage, StaffSkeleton, StaffErrorState } from "@/features/staff-ds";
import { useStaffLanguage } from "@/lib/staffLanguage";

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const { t, isHindi } = useStaffLanguage();
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

  const canDailyClean = myRoles?.slugs.includes(OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER) ?? true;

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
          title: t("attendance_checked_in"),
          description: queuedSavedMessage("punch"),
        });
        return;
      }
      toast({ title: t("attendance_checked_in"), description: "Selfie and GPS recorded for shift check-in" });
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
  const otherToday = jobs.today;
  const otherPending = otherToday.filter(j => j.status !== "completed" && j.status !== "cancelled").length;

  const totalToday = routeStops.length;
  const completedToday = dailyDone;
  const progressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  // DERIVE EXACTLY ONE NEXT TASK FOR HERO (Operational Lifecycle):
  // 1. If an appointment job is actively in-progress, en-route, or paused, prioritize it as the active focus.
  // 2. Otherwise, prioritize morning DCMS route stops.
  // 3. When DCMS is completed, prioritize the next scheduled appointment job.
  const activeBookingJob = jobs.today.find(
    j => j.status === "in_progress" || j.status === "en_route" || j.status === "paused"
  );
  const nextDailyStop = (!activeBookingJob)
    ? (routeStops.find(s => s.todayStatus === "pending" || s.todayStatus === "rejected") ?? null)
    : null;
  const nextBookingJob = activeBookingJob ?? (
    (!nextDailyStop && otherPending > 0)
      ? (jobs.today.find(j => j.status !== "completed" && j.status !== "cancelled") ?? null)
      : null
  );

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
        jobKey: staffJobKey(nextBookingJob),
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

  const firstName = user?.name?.split(" ")[0] ?? "";
  const greeting = isHindi
    ? `नमस्ते, ${firstName || "साथी"}!`
    : `Hello, ${firstName || "there"}!`;

  const dateLabel = new Date().toLocaleDateString(isHindi ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleNextTaskAction = () => {
    if (!nextTask) return;
    if (nextTask.type === "daily_clean" && nextDailyStop) {
      setSelectedCleanStop({
        subscriptionId: nextDailyStop.subscriptionId,
        customerId: nextDailyStop.customerId,
        vehicleId: nextDailyStop.vehicleId,
        customerName: nextDailyStop.customerName,
        vehicleNumber: nextDailyStop.vehicleNumber,
        vehicleMake: nextDailyStop.vehicleMake,
        vehicleModel: nextDailyStop.vehicleModel,
        vehicleColor: nextDailyStop.vehicleColor,
        societyName: nextDailyStop.societyName,
        parkingLevel: nextDailyStop.parkingLevel,
        parkingBay: nextDailyStop.parkingBay,
        todayStatus: nextDailyStop.todayStatus,
        remainingCleanings: nextDailyStop.remainingCleanings,
      });
    }
  };

  const handleSuccessfulClean = (isQueued?: boolean) => {
    if (staffId && selectedCleanStop) {
      saveDcmsLocalRecord(staffId, {
        subscriptionId: selectedCleanStop.subscriptionId,
        vehicleNumber: selectedCleanStop.vehicleNumber,
        status: "completed",
        actionLabel: isQueued
          ? (isHindi ? "फोन पर सुरक्षित (सिंक पेंडिंग)" : "Saved on phone (sync pending)")
          : (isHindi ? "सफाई पूरी हुई" : "Cleaning Completed"),
        isPendingSync: Boolean(isQueued),
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
    <StaffPage className="pb-8 space-y-4">
      <StaffPushPrompt />

      {myProfile && (
        <StaffVerificationBanner status={myProfile.verificationStatus} notes={myProfile.verificationNotes} />
      )}

      {/* TOP HEADER: GREETING & DATE */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">{greeting}</h1>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>

        {/* COMPACT VERIFIED BADGE (WHEN CHECKED IN) */}
        {isCheckedIn && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Check size={12} className="text-emerald-600" />
            <span>{t("attendance_verified")}{todayAttendance?.checkInTime ? ` (${todayAttendance.checkInTime})` : ""}</span>
          </div>
        )}
      </div>

      {/* SHIFT ATTENDANCE: DISPLAYED PROMINENTLY ONLY WHEN CHECK-IN IS PENDING (Phase 3) */}
      {!isCheckedIn && (
        <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 p-4 space-y-3 staff-elevated" data-testid="dashboard-checkin-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300">
              <Clock size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                {t("attendance_shift")}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {t("attendance_not_checked_in")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleAttendanceCheckIn()}
            disabled={markMutation.isPending}
            className="w-full h-12 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm"
            data-testid="staff-check-in-btn"
          >
            {markMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t("attendance_checking_in")}</span>
              </>
            ) : (
              <>
                <Camera size={16} />
                <span>{t("attendance_check_in")}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* TODAY'S DCMS DAILY PROGRESS OVERVIEW */}
      <Link href="/staff/daily-clean" className="block">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:border-primary/40 transition-all staff-elevated" data-testid="staff-daily-progress-section">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Sparkles size={16} className="text-primary" />
              {t("nav_dcms")}
            </span>
            <span className="font-bold text-primary flex items-center gap-0.5">
              <span>{completedToday} / {totalToday} {t("progress_summary")}</span>
              <ChevronRight size={14} />
            </span>
          </div>

          {/* PROGRESS BAR */}
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
            <span>
              {dailyPending > 0
                ? `${dailyPending} ${isHindi ? "गाड़ियां बाकी हैं" : "vehicles pending"}`
                : isHindi
                  ? "सभी गाड़ियां साफ हो चुकी हैं"
                  : "All vehicles completed"}
            </span>
            <span className="font-semibold text-foreground">{progressPercent}%</span>
          </div>
        </div>
      </Link>

      {/* OTHER JOBS STATUS CARD */}
      <Link href="/staff/bookings" className="block">
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition-all staff-elevated">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wrench size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{t("my_other_jobs_title")}</p>
              <p className="text-xs text-muted-foreground truncate">
                {otherPending > 0
                  ? `${otherPending} ${t("other_jobs_pending")}`
                  : t("other_jobs_none")}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" />
        </div>
      </Link>

      {/* EXACTLY ONE PRIMARY NEXT ACTION (Phase 3: No competing actions) */}
      {nextTask ? (
        <div className="space-y-1.5 pt-1">
          <NextTaskCard
            task={nextTask}
            onAction={nextTask.type === "daily_clean" ? handleNextTaskAction : undefined}
            actionLabel={nextTask.type === "daily_clean" ? t("complete_cleaning_action") : t("action_start")}
          />
        </div>
      ) : totalToday > 0 && dailyPending === 0 && otherPending === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
            {t("all_tasks_completed_title")}
          </h3>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
            {t("all_tasks_completed_desc")}
          </p>
        </div>
      ) : null}

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
