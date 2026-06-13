import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStaffAttendance,
  getGetStaffAttendanceQueryKey,
  useMarkAttendance,
  useGetStaffPerformance,
  getGetStaffPerformanceQueryKey,
  useGetStaffLeaderboard,
  getGetStaffLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useAccountScope } from "@/lib/account-scope";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Star, Calendar, Trophy, LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { todayIso } from "@/lib/staff-jobs";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";

const statusColors: Record<string, string> = {
  present: "bg-green-500/10 text-green-600 border-green-500/20",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  late: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  half_day: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [calendarOpen, setCalendarOpen] = useState(false);

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

  const markMutation = useMarkAttendance({
    mutation: {
      onSuccess: () => {
        if (staffId != null) {
          qc.invalidateQueries({ queryKey: getGetStaffAttendanceQueryKey(staffId) });
        }
        toast({ title: "Attendance marked" });
      },
    },
  });

  const todayStr = todayIso();
  const todayRecord = (attendance ?? []).find(a => a.date === todayStr);
  const todayMarked = Boolean(todayRecord);
  const presentDays = (attendance ?? []).filter(a => a.status === "present").length;
  const myRank = staffId != null ? (leaderboard ?? []).findIndex(s => s.staffId === staffId) + 1 : 0;

  if (scopeLoading || missingStaffLink || staffId == null) {
    return (
      <StaffAccountGate scopeLoading={scopeLoading} missingStaffLink={missingStaffLink} staffId={staffId}>
        {null}
      </StaffAccountGate>
    );
  }

  return (
    <StaffAppShell>
      <div className="space-y-5 pb-4">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center font-display font-bold text-xl text-primary shrink-0"
            data-testid="profile-avatar"
          >
            {initials(user?.name)}
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl truncate">{user?.name}</h1>
            <p className="text-sm text-muted-foreground">Field Technician</p>
            {user?.phone && <p className="text-xs text-muted-foreground mt-0.5">{user.phone}</p>}
          </div>
        </div>

        <section
          className="rounded-2xl border border-border bg-card p-4 space-y-3"
          data-testid="profile-attendance-today"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Today&apos;s attendance</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayMarked
                  ? `Marked ${todayRecord?.status?.replace(/_/g, " ")}${todayRecord?.checkInTime ? ` at ${todayRecord.checkInTime}` : ""}`
                  : "Not marked yet"}
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
                    id: staffId,
                    data: {
                      date: todayStr,
                      status: "present",
                      checkInTime: new Date().toTimeString().slice(0, 5),
                    },
                  })
                }
              >
                <CheckCircle size={16} className="mr-2" />
                Mark present
              </Button>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3" data-testid="profile-stats">
          {[
            { label: "Jobs this month", value: perf?.jobsCompleted, icon: Calendar },
            { label: "Rating", value: perf?.averageRating?.toFixed(1), icon: Star, suffix: "/5" },
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

        <PushNotificationSettings />

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
    </StaffAppShell>
  );
}
