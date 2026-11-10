import { useState, useMemo } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useAccountScope } from "@/lib/account-scope";
import { useCustomerDcmsDashboard, usePendingFeedback, usePauseMutations } from "../api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Droplets, History, Camera, ArrowRight, Pause, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { CustomerVisitFeedback } from "../components/CustomerVisitFeedback";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerSkeleton,
  CustomerButton,
} from "@/features/customer-ds";
import { cn } from "@/lib/utils";

type DcmsStats = {
  subscriptionId?: number;
  allocatedCleanings?: number;
  usedCleanings?: number;
  remainingCleanings?: number;
  allocatedWashes?: number;
  usedWashes?: number;
  remainingWashes?: number;
  status?: string;
  todayVisitStatus?: string;
  todayVisitHeadline?: string | null;
  missedCleanings?: number;
  renewalEligible?: boolean;
  renewalBlocked?: boolean;
  pauseStartDate?: string;
  pauseEndDate?: string;
};

/** Compact card for customer home dashboard. */
export function DcmsHomeCard() {
  const { customerId } = useAccountScope();
  const { data, isLoading } = useCustomerDcmsDashboard(customerId != null);
  const stats = data?.stats as DcmsStats | null;

  if (isLoading) return null;
  if (!stats?.subscriptionId) return null;

  const cleaningsDone = stats.usedCleanings ?? 0;
  const cleaningsTotal = stats.allocatedCleanings ?? 0;
  const washesDone = stats.usedWashes ?? 0;
  const washesTotal = stats.allocatedWashes ?? 0;

  return (
    <div data-testid="dcms-home-card" className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_8px_rgba(11,29,54,0.04)] space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles size={14} /> My Daily Cleaning Plan
        </p>
        <span
          className={cn(
            "text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border",
            stats.status === "paused"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200",
          )}
        >
          {stats.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-muted-foreground text-xs font-medium">Cleanings</p>
          <p className="font-display font-bold text-lg text-foreground mt-0.5">
            {cleaningsTotal - (stats.remainingCleanings ?? 0)} / {cleaningsTotal}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-muted-foreground text-xs font-medium">Washes</p>
          <p className="font-display font-bold text-lg text-foreground mt-0.5">
            {washesDone} / {washesTotal}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <CustomerButton href="/customer/daily-cleaning/history" variant="outline" size="sm" className="flex-1 text-xs">
          View History
        </CustomerButton>
        <CustomerButton href="/customer/daily-cleaning/gallery" variant="outline" size="sm" className="flex-1 text-xs">
          View Photos
        </CustomerButton>
        <CustomerButton href="/customer/daily-cleaning" size="sm" className="text-xs">
          Open <ArrowRight size={12} className="ml-1" />
        </CustomerButton>
      </div>
    </div>
  );
}

export default function CustomerDailyCleaningPage() {
  const { data, isLoading } = useCustomerDcmsDashboard();
  const { data: pendingFeedback, refetch: refetchFeedback } = usePendingFeedback();
  const { requestPause } = usePauseMutations();
  const { toast } = useToast();

  const [pauseForm, setPauseForm] = useState({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
  const [touched, setTouched] = useState({ pauseStartDate: false, pauseEndDate: false, pauseReason: false });

  const stats = data?.stats as DcmsStats | null;

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Form validations
  const startDateError = useMemo(() => {
    if (!touched.pauseStartDate || !pauseForm.pauseStartDate) return null;
    if (pauseForm.pauseStartDate < todayStr) return "Start date cannot be in the past";
    return null;
  }, [touched.pauseStartDate, pauseForm.pauseStartDate, todayStr]);

  const endDateError = useMemo(() => {
    if (!touched.pauseEndDate || !pauseForm.pauseEndDate) return null;
    if (pauseForm.pauseStartDate && pauseForm.pauseEndDate < pauseForm.pauseStartDate) {
      return "End date must be on or after start date";
    }
    return null;
  }, [touched.pauseEndDate, pauseForm.pauseStartDate, pauseForm.pauseEndDate]);

  const reasonError = useMemo(() => {
    if (!touched.pauseReason) return null;
    if (!pauseForm.pauseReason.trim()) return "Please enter a reason for the pause request";
    return null;
  }, [touched.pauseReason, pauseForm.pauseReason]);

  const canSubmitPause = Boolean(
    pauseForm.pauseStartDate &&
    pauseForm.pauseEndDate &&
    pauseForm.pauseReason.trim() &&
    !startDateError &&
    !endDateError &&
    !reasonError,
  );

  const cleaningsUsed = stats?.usedCleanings ?? 0;
  const cleaningsTotal = stats?.allocatedCleanings ?? 0;
  const cleaningsRemaining = stats?.remainingCleanings ?? (cleaningsTotal - cleaningsUsed);
  const cleaningsPct = cleaningsTotal > 0 ? Math.min(100, Math.round((cleaningsUsed / cleaningsTotal) * 100)) : 0;

  const washesUsed = stats?.usedWashes ?? 0;
  const washesTotal = stats?.allocatedWashes ?? 0;
  const washesRemaining = stats?.remainingWashes ?? (washesTotal - washesUsed);
  const washesPct = washesTotal > 0 ? Math.min(100, Math.round((washesUsed / washesTotal) * 100)) : 0;

  return (
    <CustomerLayout>
      <CustomerPage className="space-y-6">
        <CustomerHeader
          title="Daily Cleaning"
          subtitle="Doorstep vehicle maintenance, cleaning progress & schedules"
        />

        {(pendingFeedback ?? []).length > 0 && (
          <CustomerVisitFeedback
            visitId={pendingFeedback![0]!.visit.id}
            onSubmitted={() => void refetchFeedback()}
          />
        )}

        {isLoading ? (
          <div className="space-y-4">
            <CustomerSkeleton className="h-44 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <CustomerSkeleton className="h-28 rounded-2xl" />
              <CustomerSkeleton className="h-28 rounded-2xl" />
            </div>
            <CustomerSkeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : !stats ? (
          <CustomerEmptyState
            title="No active daily cleaning subscription"
            description="Your daily cleaning plan will appear here once activated."
            hint="Contact your CWP representative or explore available plans."
          />
        ) : (
          <div className="space-y-6">
            {/* Plan Overview Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgba(11,29,54,0.04)]">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      Doorstep Service
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                        stats.status === "paused"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200",
                      )}
                    >
                      {stats.status}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground mt-1 tracking-tight">
                    Your Daily Cleaning Plan
                  </h2>
                </div>

                {stats.status === "paused" && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                    Paused
                  </Badge>
                )}
              </div>

              {/* Pause period banner if paused */}
              {stats.status === "paused" && stats.pauseStartDate && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-center gap-2.5 text-xs text-amber-900">
                  <Pause size={15} className="text-amber-700 shrink-0" />
                  <span>
                    Subscription is currently paused from <strong>{stats.pauseStartDate}</strong> to <strong>{stats.pauseEndDate}</strong>. Visits will resume automatically.
                  </span>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cleanings Metric */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-primary" /> Daily Dusting & Wiping
                    </span>
                    <span className="font-medium text-muted-foreground tabular-nums">
                      {cleaningsUsed} / {cleaningsTotal} Used
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display font-bold text-2xl sm:text-3xl text-foreground tabular-nums">
                      {cleaningsRemaining}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">Cleanings Left</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${cleaningsPct}%` }}
                    />
                  </div>
                </div>

                {/* Washes Metric */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Droplets size={14} className="text-cyan-600" /> Full Foam Washes
                    </span>
                    <span className="font-medium text-muted-foreground tabular-nums">
                      {washesUsed} / {washesTotal} Used
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display font-bold text-2xl sm:text-3xl text-foreground tabular-nums">
                      {washesRemaining}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">Washes Left</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-600 transition-all duration-500 ease-out"
                      style={{ width: `${washesPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Visit Status Banner */}
            {stats.todayVisitHeadline && (stats.todayVisitStatus === "completed" || stats.todayVisitStatus === "car_not_available") && (
              <div
                className={cn(
                  "rounded-2xl border p-4 sm:p-5 flex items-start gap-3.5 shadow-[0_2px_8px_rgba(11,29,54,0.04)]",
                  stats.todayVisitStatus === "completed"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-amber-200 bg-amber-50/50",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                    stats.todayVisitStatus === "completed"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-amber-100 text-amber-700 border-amber-200",
                  )}
                >
                  {stats.todayVisitStatus === "completed" ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                    {stats.todayVisitHeadline}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {stats.todayVisitStatus === "completed"
                      ? "Your vehicle was attended to and wiped by our doorstep service specialist today."
                      : "CWP staff visited, but the vehicle was not accessible. This visit did not deduct any cleaning credits."}
                  </p>
                </div>
              </div>
            )}

            {/* Quick Navigation to History & Gallery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <CustomerButton
                href="/customer/daily-cleaning/history"
                variant="outline"
                className="justify-center gap-2 h-12"
              >
                <History className="h-4 w-4 text-primary" /> View Visit History
              </CustomerButton>
              <CustomerButton
                href="/customer/daily-cleaning/gallery"
                variant="outline"
                className="justify-center gap-2 h-12"
              >
                <Camera className="h-4 w-4 text-primary" /> View Photo Gallery
              </CustomerButton>
            </div>

            {/* Request Pause Section */}
            {stats.status === "active" && stats.subscriptionId && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgba(11,29,54,0.04)] space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary border border-blue-100/60 flex items-center justify-center shrink-0">
                    <Pause size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Temporary Suspension
                    </span>
                    <h3 className="font-display font-bold text-base sm:text-lg text-foreground mt-0.5">
                      Request Service Pause
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Traveling or vehicle unavailable? You can pause daily cleanings. Requires administrator approval. No credits will be deducted during approved pauses.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="pause-from" className="text-xs font-semibold text-foreground">
                        Pause Start Date *
                      </Label>
                      <Input
                        id="pause-from"
                        type="date"
                        min={todayStr}
                        value={pauseForm.pauseStartDate}
                        onChange={e => {
                          setPauseForm(f => ({ ...f, pauseStartDate: e.target.value }));
                          setTouched(t => ({ ...t, pauseStartDate: true }));
                        }}
                        className={cn(
                          "mt-1 h-11 text-sm rounded-xl",
                          startDateError && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {startDateError && (
                        <p className="text-[11px] text-destructive mt-1 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {startDateError}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="pause-to" className="text-xs font-semibold text-foreground">
                        Pause End Date *
                      </Label>
                      <Input
                        id="pause-to"
                        type="date"
                        min={pauseForm.pauseStartDate || todayStr}
                        value={pauseForm.pauseEndDate}
                        onChange={e => {
                          setPauseForm(f => ({ ...f, pauseEndDate: e.target.value }));
                          setTouched(t => ({ ...t, pauseEndDate: true }));
                        }}
                        className={cn(
                          "mt-1 h-11 text-sm rounded-xl",
                          endDateError && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {endDateError && (
                        <p className="text-[11px] text-destructive mt-1 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {endDateError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pause-reason" className="text-xs font-semibold text-foreground">
                      Reason for Pause *
                    </Label>
                    <Input
                      id="pause-reason"
                      placeholder="E.g., Out of station for family vacation"
                      value={pauseForm.pauseReason}
                      onChange={e => {
                        setPauseForm(f => ({ ...f, pauseReason: e.target.value }));
                        setTouched(t => ({ ...t, pauseReason: true }));
                      }}
                      className={cn(
                        "mt-1 h-11 text-sm rounded-xl",
                        reasonError && "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                    {reasonError && (
                      <p className="text-[11px] text-destructive mt-1 font-medium flex items-center gap-1">
                        <AlertCircle size={12} /> {reasonError}
                      </p>
                    )}
                  </div>

                  <CustomerButton
                    size="default"
                    className="w-full mt-2"
                    loading={requestPause.isPending}
                    disabled={requestPause.isPending || !canSubmitPause}
                    onClick={async () => {
                      setTouched({ pauseStartDate: true, pauseEndDate: true, pauseReason: true });
                      if (!canSubmitPause) return;
                      try {
                        await requestPause.mutateAsync({ subscriptionId: stats.subscriptionId!, ...pauseForm });
                        toast({ title: "Pause request submitted for administrator approval" });
                        setPauseForm({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
                        setTouched({ pauseStartDate: false, pauseEndDate: false, pauseReason: false });
                      } catch (e) {
                        toast({ title: "Request failed", description: (e as Error).message, variant: "destructive" });
                      }
                    }}
                  >
                    Submit Pause Request
                  </CustomerButton>
                </div>
              </div>
            )}
          </div>
        )}
      </CustomerPage>
    </CustomerLayout>
  );
}
