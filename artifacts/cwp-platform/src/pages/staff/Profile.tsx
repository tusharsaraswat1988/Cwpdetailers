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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Star, Calendar, Trophy, LogOut, ChevronDown, ChevronUp, Loader2, MapPin, Save } from "lucide-react";
import { todayIso } from "@/lib/staff-jobs";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { markAttendanceWithLocation } from "@/lib/location";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { resolveMediaUrl } from "@/lib/media-url";
import { StaffTeamSection } from "@/components/staff/StaffTeamSection";

const statusColors: Record<string, string> = {
  present: "bg-green-500/10 text-green-600 border-green-500/20",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  late: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  half_day: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

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
    <div className="space-y-5 pb-4">
        {loadingProfile ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : profile ? (
          <>
            <StaffVerificationBanner status={profile.verificationStatus} notes={profile.verificationNotes} />
          </>
        ) : null}

        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.name ?? "Staff"}
              className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-border"
              data-testid="profile-avatar-photo"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center font-display font-bold text-xl text-primary shrink-0"
              data-testid="profile-avatar"
            >
              {initials(user?.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-xl truncate">{user?.name}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p className="text-sm text-muted-foreground">{roleLabel}</p>
              {profile && <StaffVerificationBadge status={profile.verificationStatus} />}
            </div>
            {profile?.employeeCode && (
              <p className="text-xs text-muted-foreground mt-0.5">{profile.employeeCode}</p>
            )}
            {user?.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
          </div>
        </div>

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
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Employment (read-only)</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Branch</p>
                <p className="font-medium mt-0.5">{profile.branchName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="font-medium mt-0.5">{profile.joiningDate ?? "—"}</p>
              </div>
              {profile.partnerName && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Partner</p>
                  <p className="font-medium mt-0.5">{profile.partnerName}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {profile && !isSupervisor && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Emergency contact</p>
            <div className="grid gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  className="mt-1 h-9 text-sm"
                  value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  className="mt-1 h-9 text-sm"
                  value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)}
                  placeholder="10-digit mobile"
                />
              </div>
              <Button
                size="sm"
                className="w-fit h-9"
                disabled={saveEmergencyMutation.isPending}
                onClick={() =>
                  saveEmergencyMutation.mutate({
                    emergencyContactName: emergencyName.trim(),
                    emergencyContactPhone: emergencyPhone.trim(),
                  })
                }
              >
                {saveEmergencyMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                Save contact
              </Button>
            </div>
          </section>
        )}

        {!isSupervisor && (
          <section className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
              onClick={() => setAddressOpen(v => !v)}
            >
              <span className="text-sm font-semibold">My address</span>
              {addressOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {addressOpen && profile && (
              <div className="px-4 pb-4 text-xs space-y-1 border-t border-border pt-3 text-muted-foreground">
                <p>{profile.currentHouseNumber} {profile.currentStreet}</p>
                <p>{profile.currentArea}{profile.currentLandmark ? `, ${profile.currentLandmark}` : ""}</p>
                <p>{profile.currentCity}, {profile.currentState} — {profile.currentPincode}</p>
                {!profile.addressComplete && (
                  <p className="text-amber-600 pt-2">Address incomplete — ask admin to update your profile.</p>
                )}
              </div>
            )}
          </section>
        )}

        {!isSupervisor && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="profile-attendance-today">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Today&apos;s attendance</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {todayMarked
                    ? `Marked ${todayRecord?.status?.replace(/_/g, " ")}${todayRecord?.checkInTime ? ` at ${todayRecord.checkInTime}` : ""}`
                    : "GPS check-in required before starting field work"}
                </p>
              </div>
              {todayMarked ? (
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <CheckCircle size={16} />
                  Done
                </div>
              ) : (
                <Button
                  className="h-12 px-5 font-semibold bg-primary text-secondary hover:bg-primary/90 shrink-0"
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
                  {markMutation.isPending ? "Getting GPS…" : "Check in with GPS"}
                </Button>
              )}
            </div>
          </section>
        )}

        {!isSupervisor && (
          <div className="grid grid-cols-2 gap-3" data-testid="profile-stats">
            {[
              { label: "Jobs this month", value: perf?.jobsCompleted ?? profile?.performance?.completedJobs, icon: Calendar },
              { label: "Rating", value: (perf?.averageRating ?? profile?.performance?.averageRating)?.toFixed(1), icon: Star, suffix: "/5" },
              { label: "Present days", value: presentDays, icon: CheckCircle },
              { label: "Rank", value: myRank > 0 ? `#${myRank}` : "—", icon: Trophy },
            ].map(({ label, value, icon: Icon, suffix }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={13} className="text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
                </div>
                {loadingPerf && label !== "Present days" ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="font-display font-bold text-xl text-primary">
                    {value ?? 0}
                    {suffix ?? ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {!isSupervisor && (
          <section className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
              onClick={() => setCalendarOpen(v => !v)}
              data-testid="profile-calendar-toggle"
            >
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <span className="text-sm font-semibold">Monthly attendance</span>
              </div>
              {calendarOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {calendarOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                <input
                  type="month"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card"
                  data-testid="input-month"
                />
                {loadingAttendance ? (
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                  </div>
                ) : (attendance ?? []).length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">No records this month</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {(attendance ?? []).map(a => (
                      <div
                        key={a.id}
                        className={`rounded-lg border p-2 text-center ${statusColors[a.status] ?? "border-border"}`}
                        data-testid={`attendance-${a.date}`}
                      >
                        <p className="font-bold text-sm">{a.date?.split("-")[2]}</p>
                        <p className="text-[10px] capitalize mt-0.5">{a.status?.replace(/_/g, " ")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <PushNotificationSettings variant="staff" />

        <Button
          variant="outline"
          className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={logout}
          data-testid="btn-sign-out"
        >
          <LogOut size={16} className="mr-2" />
          Sign out
        </Button>
      </div>
  );
}
