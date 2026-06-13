import { useQuery } from "@tanstack/react-query";
import { useListStaff } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CompletionRing } from "@/components/shared/CompletionRing";
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Users, Activity, Wifi, WifiOff,
} from "lucide-react";
import { Link } from "wouter";

async function fetchTodayBookings() {
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(`/api/bookings?scheduledDate=${today}&limit=200`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchOpenComplaints() {
  const res = await fetch("/api/complaints?status=open&limit=20", { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchDailyOps() {
  const res = await fetch("/api/subscriptions/daily-ops", { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const REFRESH_MS = 30000;

export default function OperationsWall() {
  const { data: bookingsData, dataUpdatedAt } = useQuery({
    queryKey: ["ops-wall-bookings"],
    queryFn: fetchTodayBookings,
    refetchInterval: REFRESH_MS,
  });
  const { data: complaintsData } = useQuery({
    queryKey: ["ops-wall-complaints"],
    queryFn: fetchOpenComplaints,
    refetchInterval: REFRESH_MS,
  });
  const { data: dailyOps } = useQuery({
    queryKey: ["ops-wall-daily-ops"],
    queryFn: fetchDailyOps,
    refetchInterval: REFRESH_MS,
  });
  const { data: staffData } = useListStaff({ isActive: true } as any, {
    query: { queryKey: ["ops-wall-staff"], refetchInterval: REFRESH_MS },
  });
  const { data: health } = useQuery({
    queryKey: ["ops-wall-health"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/health", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: REFRESH_MS,
  });

  const allBookings = (bookingsData?.data ?? []) as any[];
  const scheduled = allBookings.filter((b: any) => b.status === "scheduled");
  const enRoute = allBookings.filter((b: any) => b.status === "en_route");
  const inProgress = allBookings.filter((b: any) => b.status === "in_progress");
  const completed = allBookings.filter((b: any) => b.status === "completed");

  const now = new Date();
  const delayed = allBookings.filter((b: any) => {
    if (b.status === "completed" || b.status === "cancelled") return false;
    if (!b.scheduledTime) return false;
    const [h, m] = (b.scheduledTime as string).split(":").map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(h, m, 0, 0);
    return now.getTime() - scheduled.getTime() > 2 * 60 * 60 * 1000;
  });

  const lowBalanceContracts = (dailyOps?.schedulerPreview?.blocked ?? []) as any[];
  const openComplaints = (complaintsData?.data ?? []) as any[];
  const activeStaff = (staffData ?? []) as any[];

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="min-h-screen bg-secondary text-white p-6 space-y-6" data-testid="operations-wall">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl tracking-tight">CWP Operations</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <Wifi size={14} className="text-green-400" />
          <span>Last updated {lastRefresh}</span>
          <span className="text-white/20">·</span>
          <span>Auto-refresh {REFRESH_MS / 1000}s</span>
          <Link href="/admin/dashboard" className="ml-4 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors text-xs">
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Status Lane Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Scheduled", count: scheduled.length, color: "bg-sky-500/20 border-sky-500/30 text-sky-300", icon: Clock },
          { label: "En Route", count: enRoute.length, color: "bg-orange-500/20 border-orange-500/30 text-orange-300", icon: Activity },
          { label: "In Progress", count: inProgress.length, color: "bg-primary/20 border-primary/30 text-primary", icon: Activity },
          { label: "Completed", count: completed.length, color: "bg-green-500/20 border-green-500/30 text-green-300", icon: CheckCircle2 },
          { label: "Delayed", count: delayed.length, color: delayed.length > 0 ? "bg-red-500/20 border-red-500/30 text-red-300" : "bg-white/5 border-white/10 text-white/50", icon: AlertTriangle },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`} data-testid={`wall-stat-${label.toLowerCase().replace(" ", "-")}`}>
            <Icon size={18} className="mb-2" />
            <p className="font-display font-bold text-4xl tabular-nums">{count}</p>
            <p className="text-xs mt-1 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      {/* Completion Ring + quick summary */}
      {allBookings.length > 0 && (
        <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
          <CompletionRing value={completed.length} max={allBookings.length} size={72} />
          <div>
            <p className="font-display font-bold text-2xl">{completed.length}/{allBookings.length} jobs done today</p>
            <p className="text-white/40 text-sm">{inProgress.length + enRoute.length} active · {scheduled.length} waiting · {delayed.length} delayed</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Live Job Board */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-display font-bold text-lg text-white/80 flex items-center gap-2">
            <Activity size={16} className="text-primary" /> Live Jobs
          </h2>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {[...inProgress, ...enRoute, ...delayed, ...scheduled].slice(0, 20).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3" data-testid={`wall-job-${b.id}`}>
                <div>
                  <p className="font-medium text-sm">{b.customerName ?? `Customer #${b.customerId}`}</p>
                  <p className="text-xs text-white/40 capitalize">{b.serviceType?.replace(/_/g, " ")} · {b.scheduledTime ?? "—"}</p>
                </div>
                <StatusBadge status={b.status ?? "scheduled"} />
              </div>
            ))}
            {allBookings.length === 0 && (
              <div className="text-center py-8 text-white/30 text-sm">No jobs scheduled for today</div>
            )}
          </div>
        </div>

        {/* Right column: Low Balance + Complaints + Staff */}
        <div className="space-y-5">
          {/* Low Balance Contracts */}
          <div>
            <h2 className="font-display font-bold text-base text-white/80 flex items-center gap-2 mb-2">
              <AlertCircle size={15} className="text-amber-400" /> Low Balance
              <span className="ml-auto text-amber-400 font-bold text-lg">{lowBalanceContracts.length}</span>
            </h2>
            <div className="space-y-1.5 max-h-[20vh] overflow-y-auto">
              {lowBalanceContracts.slice(0, 8).map((b: any) => (
                <div key={b.subscriptionId} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs">
                  <span className="text-amber-200">Sub #{b.subscriptionId}</span>
                  <span className="text-amber-400">{(b.reason ?? "").replace(/_/g, " ")}</span>
                </div>
              ))}
              {lowBalanceContracts.length === 0 && (
                <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  ✓ No blocked contracts
                </p>
              )}
            </div>
          </div>

          {/* Open Complaints */}
          <div>
            <h2 className="font-display font-bold text-base text-white/80 flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-red-400" /> Open Complaints
              <span className="ml-auto text-red-400 font-bold text-lg">{openComplaints.length}</span>
            </h2>
            <div className="space-y-1.5 max-h-[20vh] overflow-y-auto">
              {openComplaints.slice(0, 5).map((c: any) => (
                <div key={c.id} className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs" data-testid={`wall-complaint-${c.id}`}>
                  <p className="text-red-200 font-medium truncate">{c.title}</p>
                  <p className="text-red-400/70 mt-0.5 capitalize">{c.type}</p>
                </div>
              ))}
              {openComplaints.length === 0 && (
                <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  ✓ No open complaints
                </p>
              )}
            </div>
          </div>

          {/* Active Staff */}
          <div>
            <h2 className="font-display font-bold text-base text-white/80 flex items-center gap-2 mb-2">
              <Users size={15} className="text-white/60" /> Active Staff
              <span className="ml-auto text-white font-bold text-lg">{activeStaff.length}</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {activeStaff.slice(0, 12).map((s: any) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-full px-3 py-1 text-xs text-white/70" data-testid={`wall-staff-${s.id}`}>
                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[9px] font-bold shrink-0">
                    {(s.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  {s.name?.split(" ")[0]}
                </span>
              ))}
              {activeStaff.length === 0 && (
                <p className="text-xs text-white/30">No active staff found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
