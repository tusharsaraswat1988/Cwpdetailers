import { useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  useGetStaffAttendance,
  getGetStaffAttendanceQueryKey,
  useGetStaffPerformance,
  getGetStaffPerformanceQueryKey,
  useGetStaffLeaderboard,
  getGetStaffLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useAccountScope } from "@/lib/account-scope";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { StaffVerificationBadge } from "@/features/staff/components/StaffVerificationBanner";
import { StaffOperationalRoles } from "@/features/staff/components/StaffOperationalRoles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Star, Calendar, Trophy, LogOut, ChevronDown, ChevronUp, Loader2, Camera } from "lucide-react";
import { todayIso } from "@/lib/staff-jobs";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { markAttendanceWithLocation } from "@/lib/location";
import { captureStaffPhoto, isCameraCancel } from "@/lib/native/captureStaffPhoto";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { isDailyCleanOnlyStaff } from "@/lib/staff-ecosystem/roles";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { resolveMediaUrl } from "@/lib/media-url";
import { StaffTeamSection } from "@/components/staff/StaffTeamSection";
import {
  StaffPage,
  StaffButton,
  StaffSkeleton,
  StaffProfileCard,
  StaffAttendanceCard,
  StaffMetric,
  StaffStatusBadge,
} from "@/features/staff-ds";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-profile"],
    queryFn: staffEcosystemApi.getMyProfile,
    enabled: staffId != null,
  });

  const { data: myContext } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"],
    queryFn: staffEcosystemApi.getMyContext,
    enabled: staffId != null,
  });

  const { data: attendance, isLoading: loadingAttendance } = useGetStaffAttendance(
    staffId ?? 0,
    { month },
    {
      query: {
        queryKey: getGetStaffAttendanceQueryKey(staffId ?? 0, { month }),
        enabled: staffId != null,
      },
    },
  );

  const { data: perf, isLoading: loadingPerf } = useGetStaffPerformance(
    staffId ?? 0,
    { month },
    {
      query: {
        queryKey: getGetStaffPerformanceQueryKey(staffId ?? 0, { month }),
        enabled: staffId != null,
      },
    },
  );

  const { data: leaderboard } = useGetStaffLeaderboard(
    { month },
    { query: { queryKey: getGetStaffLeaderboardQueryKey({ month }) } },
  );

  const markMutation = useMutation({
    mutationFn: (payload: {
      date: string;
      status: string;
      checkInTime?: string;
      imageBase64: string;
      exif?: Record<string, unknown> | null;
      capturedAt?: string;
    }) => markAttendanceWithLocation(staffId!, payload),
    onSuccess: (data) => {
      if (staffId != null) {
        qc.invalidateQueries({ queryKey: getGetStaffAttendanceQueryKey(staffId) });
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

  const roleLabel = myContext?.staffCategory === "supervisor" ? "Supervisor" : "Cleaning Staff";
  const todayStr = todayIso();
  const todayRecord = (attendance ?? []).find(a => a.date === todayStr);
  const todayMarked = Boolean(todayRecord);
  const presentDays = (attendance ?? []).filter(a => a.status === "present").length;
  const myRank = staffId != null ? (leaderboard ?? []).findIndex(s => s.staffId === staffId) + 1 : 0;
  const isSupervisor = myContext?.staffCategory === "supervisor";
  const isDailyCleanOnly = isDailyCleanOnlyStaff((profile?.roles ?? []).map(r => r.roleSlug));
  const showShiftAttendance = Boolean(profile) && !isSupervisor && !isDailyCleanOnly;

  async function handleAttendanceCheckIn() {
    try {
      const photo = await captureStaffPhoto("front");
      await markMutation.mutateAsync({
        date: todayStr,
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

  if (scopeLoading || missingStaffLink || staffId == null) {
    return (
      <StaffAccountGate scopeLoading={scopeLoading} missingStaffLink={missingStaffLink} staffId={staffId}>
        {null}
      </StaffAccountGate>
    );
  }

  const avatarUrl = profile?.profilePhotoUrl ? resolveMediaUrl(profile.profilePhotoUrl) : null;

  return (
    <StaffPage className="pb-4 space-y-4">
      {loadingProfile ? (
        <StaffSkeleton className="h-24 w-full" />
      ) : null}

      {/* Profile Overview Header Card */}
      <StaffProfileCard
        name={user?.name ?? "Staff"}
        role={roleLabel}
        avatarUrl={avatarUrl}
        avatarFallback={initials(user?.name)}
      >
        <div className="flex flex-wrap items-center gap-2">
          {profile && <StaffVerificationBadge status={profile.verificationStatus} />}
          {profile?.employeeCode ? (
            <p className="text-xs text-muted-foreground">{profile.employeeCode}</p>
          ) : null}
          {user?.phone ? <p className="text-xs text-muted-foreground">{user.phone}</p> : null}
        </div>
      </StaffProfileCard>

      {/* Operational Roles */}
      {profile && !isSupervisor && profile.roles?.length > 0 && (
        <StaffOperationalRoles roles={profile.roles} />
      )}

      {/* Supervisor Contact (only if assigned) */}
      {myContext?.staffCategory === "cleaning_staff" && myContext.reportingManager && (
        <SupervisorContactCard
          supervisor={myContext.reportingManager}
          compact
          whatsAppMessage={`Hi ${myContext.reportingManager.name ?? "Supervisor"}, I need help with a field issue.`}
        />
      )}

      {/* Team Section (Supervisors only) */}
      <StaffTeamSection />

      {/* Attendance Check-in Card (No selfie display to staff once logged) */}
      {showShiftAttendance && (
        <StaffAttendanceCard
          status={
            markMutation.isPending
              ? "checking_in"
              : markMutation.isError
                ? "failed"
                : todayMarked
                  ? (todayRecord?.status ?? "present")
                  : "not_checked_in"
          }
          dateLabel="Today's attendance"
          selfieUrl={null}
          checkInLabel={
            todayMarked
              ? `Marked${todayRecord?.checkInTime ? ` at ${todayRecord.checkInTime}` : ""}`
              : markMutation.isError
                ? "Check-in failed. Please try again with selfie + GPS."
                : markMutation.isPending
                  ? "Capturing selfie and verifying location…"
                  : "Selfie + GPS check-in required before field work"
          }
          action={
            todayMarked ? undefined : (
              <StaffButton
                className="w-full sm:w-auto px-4"
                disabled={markMutation.isPending}
                data-testid="btn-mark-present"
                onClick={() => void handleAttendanceCheckIn()}
              >
                {markMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin shrink-0" />
                ) : (
                  <Camera size={16} className="mr-2 shrink-0" />
                )}
                {markMutation.isPending
                  ? "Selfie + GPS…"
                  : markMutation.isError
                    ? "Retry Check-in"
                    : "Check in"}
              </StaffButton>
            )
          }
        />
      )}

      {/* Key Field Performance Metrics */}
      {!isSupervisor && (
        <div className="grid grid-cols-2 gap-3" data-testid="profile-stats">
          <StaffMetric
            label="Jobs this month"
            value={
              loadingPerf
                ? "…"
                : (perf?.jobsCompleted ?? profile?.performance?.completedJobs ?? 0)
            }
            icon={<Calendar size={13} className="text-primary" aria-hidden />}
            tone="primary"
            className="text-left"
          />
          <StaffMetric
            label="Rating"
            value={
              loadingPerf
                ? "…"
                : (perf?.averageRating ?? profile?.performance?.averageRating) != null &&
                  (perf?.averageRating ?? profile?.performance?.averageRating)! > 0
                  ? `${(perf?.averageRating ?? profile?.performance?.averageRating)!.toFixed(1)}/5`
                  : "New"
            }
            icon={<Star size={13} className="text-primary" aria-hidden />}
            tone="primary"
            className="text-left"
          />
          {showShiftAttendance && (
            <StaffMetric
              label="Present days"
              value={presentDays}
              icon={<CheckCircle size={13} className="text-primary" aria-hidden />}
              tone="success"
              className="text-left"
            />
          )}
          <StaffMetric
            label="Rank"
            value={myRank > 0 ? `#${myRank}` : "—"}
            icon={<Trophy size={13} className="text-primary" aria-hidden />}
            tone="primary"
            className="text-left"
          />
        </div>
      )}

      {/* Monthly Attendance Breakdown (collapsible) */}
      {showShiftAttendance && (
        <section className="staff-card staff-elevated overflow-hidden">
          <button
            type="button"
            className="staff-tap flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
            onClick={() => setCalendarOpen(v => !v)}
            data-testid="profile-calendar-toggle"
          >
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary" aria-hidden />
              <span className="text-sm font-semibold">Monthly attendance</span>
            </div>
            {calendarOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
          </button>

          {calendarOpen && (
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="w-full rounded-[var(--staff-radius-sm)] border border-border bg-card px-3 py-3 text-sm"
                data-testid="input-month"
              />
              {loadingAttendance ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <StaffSkeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (attendance ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No records this month</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {(attendance ?? []).map(a => (
                    <div
                      key={a.id}
                      className="rounded-[var(--staff-radius-sm)] border border-border bg-card p-2 text-center"
                      data-testid={`attendance-${a.date}`}
                    >
                      <p className="text-sm font-bold">{a.date?.split("-")[2]}</p>
                      <div className="mt-1 flex justify-center">
                        <StaffStatusBadge status={a.status ?? "pending"} className="scale-90" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Clean Job Alerts & Notifications (Streamlined, no (not supported) error text) */}
      <PushNotificationSettings variant="staff" />

      {/* Two-step Logout Confirmation Button */}
      <div className="pt-2 pb-14">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <StaffButton
              variant="outline"
              className="w-full border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/15 min-h-[3.25rem] font-semibold"
              data-testid="btn-sign-out"
            >
              <LogOut size={18} className="mr-2" />
              Log out
            </StaffButton>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[340px] rounded-2xl p-5">
            <AlertDialogHeader className="text-left space-y-2">
              <AlertDialogTitle className="text-base font-bold">
                Log out karein?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Aap sure hain ki aap staff app se log out karna chahte hain? Wapas login karne ke liye apna registered mobile number enter karna hoga.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2 justify-end pt-3">
              <AlertDialogCancel className="h-9 px-4 text-xs font-medium m-0">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="h-9 px-4 text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground m-0"
                onClick={() => logout("staff")}
                data-testid="confirm-logout-btn"
              >
                Yes, Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </StaffPage>
  );
}
