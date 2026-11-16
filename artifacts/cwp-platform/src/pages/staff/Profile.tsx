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
import { StaffMyDocuments } from "@/features/staff/components/StaffMyDocuments";
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
import {
  CheckCircle,
  Star,
  Calendar,
  Trophy,
  LogOut,
  ChevronDown,
  ChevronUp,
  Globe,
  IndianRupee,
  ChevronRight,
  Check,
  PhoneCall,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { markAttendanceWithLocation } from "@/lib/location";
import { captureStaffPhoto, isCameraCancel } from "@/lib/native/captureStaffPhoto";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { isDailyCleanOnlyStaff } from "@/lib/staff-ecosystem/roles";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { resolveMediaUrl } from "@/lib/media-url";
import { StaffTeamSection } from "@/components/staff/StaffTeamSection";
import { StaffProductivityCard } from "@/components/staff/StaffProductivityCard";
import {
  StaffPage,
  StaffButton,
  StaffSkeleton,
  StaffProfileCard,
  StaffMetric,
  StaffStatusBadge,
} from "@/features/staff-ds";
import { useStaffLanguage } from "@/lib/staffLanguage";
import { Link } from "wouter";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function StaffProfile() {
  const { user, logout } = useAuth();
  const { lang, setLang, t, isHindi } = useStaffLanguage();
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

  const todayIsoDate = new Date().toISOString().split("T")[0];

  if (scopeLoading || missingStaffLink || staffId == null) {
    return (
      <StaffAccountGate
        scopeLoading={scopeLoading}
        missingStaffLink={missingStaffLink}
        staffId={staffId}
      >
        {null}
      </StaffAccountGate>
    );
  }

  const isSupervisor = myContext?.staffCategory === "supervisor";
  const myRoles = profile?.operationalRoles ?? [];
  const dailyCleanOnly = isDailyCleanOnlyStaff(myRoles);
  const showShiftAttendance = isSupervisor || dailyCleanOnly;

  const presentDays = (attendance ?? []).filter(
    (a: { status?: string }) =>
      a.status === "present" ||
      a.status === "half_day" ||
      a.status === "late" ||
      a.status === "checked_in",
  ).length;

  const myRank =
    (leaderboard ?? []).findIndex(
      (entry: { staffId: number }) => entry.staffId === staffId,
    ) + 1;

  return (
    <StaffPage className="space-y-4 pb-20">
      {/* Profile Header Card */}
      <StaffProfileCard
        name={user?.name ?? profile?.name ?? "Staff"}
        phone={user?.phone ?? profile?.phone ?? ""}
        avatarUrl={resolveMediaUrl(profile?.avatarUrl)}
        initials={initials(user?.name ?? profile?.name)}
        category={myContext?.staffCategory ?? "cleaning_staff"}
        cityName={myContext?.cityName}
        branchName={myContext?.branchName}
        verificationStatus={profile?.verificationStatus}
      />

      {/* Language Selector Card (Phase 5) */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 staff-elevated" data-testid="profile-language-card">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground font-display">{t("language_toggle")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              lang === "hi"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted/40 border-border text-foreground hover:bg-muted"
            }`}
            data-testid="language-select-hindi"
          >
            {lang === "hi" && <Check size={14} />}
            <span>हिन्दी (Hindi)</span>
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              lang === "en"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted/40 border-border text-foreground hover:bg-muted"
            }`}
            data-testid="language-select-english"
          >
            {lang === "en" && <Check size={14} />}
            <span>English</span>
          </button>
        </div>
      </div>

      {/* Earnings & Payouts Card Link */}
      <Link href="/staff/earnings" className="block">
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/40 transition-all staff-elevated">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <IndianRupee size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("earnings_payouts")}</p>
              <p className="text-xs text-muted-foreground">
                {isHindi ? "मासिक वेतन और वाश इंसेंटिव देखें" : "View compensation & monthly payouts"}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" />
        </div>
      </Link>

      {/* Supervisor Contact Card */}
      {myContext?.supervisor && (
        <SupervisorContactCard
          supervisor={myContext.supervisor}
          title={isSupervisor ? "Lead Supervisor" : "Supervisor"}
          subtitle={
            myContext.branchName
              ? `${myContext.branchName} · Operations`
              : "Operations Supervisor"
          }
        />
      )}

      {/* Performance Summary Metrics */}
      {!isSupervisor && (
        <div className="grid grid-cols-2 gap-3" data-testid="profile-stats">
          <StaffMetric
            label={isHindi ? "इस महीने के काम" : "Jobs this month"}
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
            label={isHindi ? "रेटिंग" : "Rating"}
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
              label={isHindi ? "उपस्थिति दिन" : "Present days"}
              value={presentDays}
              icon={<CheckCircle size={13} className="text-primary" aria-hidden />}
              tone="success"
              className="text-left"
            />
          )}
          <StaffMetric
            label={isHindi ? "रैंक" : "Rank"}
            value={myRank > 0 ? `#${myRank}` : "—"}
            icon={<Trophy size={13} className="text-primary" aria-hidden />}
            tone="primary"
            className="text-left"
          />
        </div>
      )}

      {/* Monthly Attendance Calendar */}
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
              <span className="text-sm font-bold">{t("my_shifts")}</span>
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
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {isHindi ? "इस महीने कोई रिकॉर्ड नहीं मिला" : "No records this month"}
                </p>
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

      {/* Compliance Documents */}
      {profile && <StaffMyDocuments profile={profile} />}

      {/* Notifications Settings */}
      <PushNotificationSettings variant="staff" />

      {/* Field Operations Support Card (P8.7) */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 staff-elevated" data-testid="profile-support-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PhoneCall size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("field_support")}</p>
              <p className="text-xs text-muted-foreground">{t("field_support_desc")}</p>
            </div>
          </div>
        </div>
        <a
          href={myContext?.supervisor?.phone ? `tel:${myContext.supervisor.phone}` : "tel:+919999999999"}
          className="w-full h-12 min-h-[48px] rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          data-testid="profile-call-support-btn"
        >
          <PhoneCall size={15} />
          <span>{t("call_support")}</span>
        </a>
      </div>

      {/* App Version & Active Session Status (P8.7) */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-xs staff-elevated" data-testid="profile-session-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>{t("session_active")}</span>
          </div>
          <span className="font-mono text-muted-foreground">ID #{staffId}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <Smartphone size={14} />
            <span>{t("app_version")}</span>
          </div>
          <span className="font-mono font-medium text-foreground">v2.0 (Build 2026.11)</span>
        </div>
      </div>

      {/* Two-step Logout Confirmation Button (P8.7) */}
      <div className="pt-2 pb-14">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <StaffButton
              variant="outline"
              className="w-full border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/15 min-h-[48px] h-12 font-bold"
              data-testid="btn-sign-out"
            >
              <LogOut size={18} className="mr-2" />
              {t("logout")}
            </StaffButton>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[340px] rounded-2xl p-5" data-testid="logout-confirm-dialog">
            <AlertDialogHeader className="text-left space-y-2">
              <AlertDialogTitle className="text-base font-bold">
                {t("logout_confirm_title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                {t("logout_confirm_desc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row gap-2 justify-end pt-3">
              <AlertDialogCancel className="h-11 min-h-[44px] px-4 text-xs font-medium m-0">
                {t("logout_cancel_btn")}
              </AlertDialogCancel>
              <AlertDialogAction
                className="h-11 min-h-[44px] px-4 text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground m-0"
                onClick={() => logout("staff")}
                data-testid="confirm-logout-btn"
              >
                {t("logout_confirm_btn")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </StaffPage>
  );
}
