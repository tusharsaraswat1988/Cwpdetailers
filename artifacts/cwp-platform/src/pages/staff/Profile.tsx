import { useState, useEffect } from "react";
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
import { StaffVerificationBanner, StaffVerificationBadge } from "@/features/staff/components/StaffVerificationBanner";
import { StaffOperationalRoles } from "@/features/staff/components/StaffOperationalRoles";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Star, Calendar, Trophy, LogOut, ChevronDown, ChevronUp, Loader2, MapPin, Save } from "lucide-react";
import { todayIso } from "@/lib/staff-jobs";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { markAttendanceWithLocation } from "@/lib/location";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { resolveMediaUrl } from "@/lib/media-url";
import { StaffTeamSection } from "@/components/staff/StaffTeamSection";
import {
  StaffPage,
  StaffButton,
  StaffInput,
  StaffSkeleton,
  StaffProfileCard,
  StaffAttendanceCard,
  StaffMetric,
  StaffStatusBadge,
  StaffCard,
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
  const [addressOpen, setAddressOpen] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

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
    mutationFn: (payload: { date: string; status: string; checkInTime?: string }) =>
      markAttendanceWithLocation(staffId!, payload),
    onSuccess: () => {
      if (staffId != null) {
        qc.invalidateQueries({ queryKey: getGetStaffAttendanceQueryKey(staffId) });
      }
      toast({ title: "Attendance marked", description: "Location recorded for shift check-in" });
    },
    onError: (err: Error) =>
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" }),
  });

  const saveEmergencyMutation = useMutation({
    mutationFn: (payload: { emergencyContactName: string; emergencyContactPhone: string }) =>
      staffEcosystemApi.patchMyProfile(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-profile"] });
      toast({ title: "Emergency contact saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (profile) {
      setEmergencyName(profile.emergencyContactName ?? "");
      setEmergencyPhone(profile.emergencyContactPhone ?? "");
    }
  }, [profile?.emergencyContactName, profile?.emergencyContactPhone]);

  const roleLabel = myContext?.staffCategory === "supervisor" ? "Supervisor" : "Cleaning Staff";
  const todayStr = todayIso();
  const todayRecord = (attendance ?? []).find(a => a.date === todayStr);
  const todayMarked = Boolean(todayRecord);
  const presentDays = (attendance ?? []).filter(a => a.status === "present").length;
  const myRank = staffId != null ? (leaderboard ?? []).findIndex(s => s.staffId === staffId) + 1 : 0;
  const isSupervisor = myContext?.staffCategory === "supervisor";

  if (scopeLoading || missingStaffLink || staffId == null) {
    return (
      <StaffAccountGate scopeLoading={scopeLoading} missingStaffLink={missingStaffLink} staffId={staffId}>
        {null}
      </StaffAccountGate>
    );
  }

  const avatarUrl = profile?.profilePhotoUrl ? resolveMediaUrl(profile.profilePhotoUrl) : null;

  return (
    <StaffPage className="pb-4">
        {loadingProfile ? (
          <StaffSkeleton className="h-24 w-full" />
        ) : profile ? (
          <>
            <StaffVerificationBanner status={profile.verificationStatus} notes={profile.verificationNotes} />
          </>
        ) : null}

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

        {profile && !isSupervisor && <StaffOperationalRoles roles={profile.roles} />}

        {myContext?.staffCategory === "cleaning_staff" && (
          <SupervisorContactCard
            supervisor={myContext.reportingManager}
            compact
            whatsAppMessage={`Hi ${myContext.reportingManager?.name ?? "Supervisor"}, I need help with a field issue.`}
          />
        )}

        <StaffTeamSection />

        {profile && !isSupervisor && (
          <StaffCard>
            <p className="text-sm font-semibold">Employment (read-only)</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Branch</p>
                <p className="mt-0.5 font-medium">{profile.branchName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="mt-0.5 font-medium">{profile.joiningDate ?? "—"}</p>
              </div>
              {profile.partnerName && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Partner</p>
                  <p className="mt-0.5 font-medium">{profile.partnerName}</p>
                </div>
              )}
            </div>
          </StaffCard>
        )}

        {profile && !isSupervisor && (
          <StaffCard>
            <p className="text-sm font-semibold">Emergency contact</p>
            <div className="mt-3 grid gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <StaffInput
                  className="mt-1"
                  value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <StaffInput
                  className="mt-1"
                  value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)}
                  placeholder="10-digit mobile"
                />
              </div>
              <StaffButton
                size="sm"
                className="staff-btn-sm w-fit"
                disabled={saveEmergencyMutation.isPending}
                onClick={() =>
                  saveEmergencyMutation.mutate({
                    emergencyContactName: emergencyName.trim(),
                    emergencyContactPhone: emergencyPhone.trim(),
                  })
                }
              >
                {saveEmergencyMutation.isPending ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Save size={14} className="mr-1" />
                )}
                Save contact
              </StaffButton>
            </div>
          </StaffCard>
        )}

        {!isSupervisor && (
          <section className="staff-card staff-elevated overflow-hidden">
            <button
              type="button"
              className="staff-tap flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
              onClick={() => setAddressOpen(v => !v)}
            >
              <span className="text-sm font-semibold">My address</span>
              {addressOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
            </button>
            {addressOpen && profile && (
              <div className="space-y-1 border-t border-border px-4 pb-4 pt-3 text-xs text-muted-foreground">
                <p>
                  {profile.currentHouseNumber} {profile.currentStreet}
                </p>
                <p>
                  {profile.currentArea}
                  {profile.currentLandmark ? `, ${profile.currentLandmark}` : ""}
                </p>
                <p>
                  {profile.currentCity}, {profile.currentState} — {profile.currentPincode}
                </p>
                {!(profile as { addressComplete?: boolean }).addressComplete && (
                  <p className="pt-2 text-[hsl(var(--tone-warning-fg))]">
                    Address incomplete — ask admin to update your profile.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {!isSupervisor && (
          <StaffAttendanceCard
            status={todayMarked ? todayRecord?.status ?? "present" : "pending"}
            dateLabel="Today's attendance"
            checkInLabel={
              todayMarked
                ? `Marked${todayRecord?.checkInTime ? ` at ${todayRecord.checkInTime}` : ""}`
                : "GPS check-in required before field work"
            }
            action={
              todayMarked ? undefined : (
                <StaffButton
                  className="shrink-0 px-4"
                  disabled={markMutation.isPending}
                  data-testid="btn-mark-present"
                  onClick={() =>
                    markMutation.mutate({
                      date: todayStr,
                      status: "present",
                      checkInTime: new Date().toTimeString().slice(0, 5),
                    })
                  }
                >
                  {markMutation.isPending ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <MapPin size={16} className="mr-2" />
                  )}
                  {markMutation.isPending ? "Getting GPS…" : "Check in"}
                </StaffButton>
              )
            }
          />
        )}

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
                  : `${(perf?.averageRating ?? profile?.performance?.averageRating)?.toFixed(1) ?? "0"}/5`
              }
              icon={<Star size={13} className="text-primary" aria-hidden />}
              tone="primary"
              className="text-left"
            />
            <StaffMetric
              label="Present days"
              value={presentDays}
              icon={<CheckCircle size={13} className="text-primary" aria-hidden />}
              tone="success"
              className="text-left"
            />
            <StaffMetric
              label="Rank"
              value={myRank > 0 ? `#${myRank}` : "—"}
              icon={<Trophy size={13} className="text-primary" aria-hidden />}
              tone="primary"
              className="text-left"
            />
          </div>
        )}

        {!isSupervisor && (
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

        <PushNotificationSettings variant="staff" />

        <StaffButton
          variant="outline"
          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={logout}
          data-testid="btn-sign-out"
        >
          <LogOut size={16} className="mr-2" />
          Sign out
        </StaffButton>
    </StaffPage>
  );
}
