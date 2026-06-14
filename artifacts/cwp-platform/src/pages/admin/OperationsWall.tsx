import { useQuery } from "@tanstack/react-query";
import { useListStaff } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CompletionRing } from "@/components/shared/CompletionRing";
import {
  Calendar, CheckCircle2, Clock, AlertTriangle,
  Users, Activity, Wifi, Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

type TimelineItem = {
  id: string;
  channel: "booking" | "dcms_visit" | "dcms_due" | "due_wash" | "execution";
  customerId: number;
  customerName: string | null;
  assetLabel: string | null;
  workType: string;
  status: string;
  scheduledAt: string;
  staffName: string | null;
  executionId?: number;
};

type ServiceUpdatesSummary = {
  date: string;
  pending: number;
  assigned: number;
  scheduled: number;
  started: number;
  completed: number;
  missed: number;
  cancelled: number;
};

type TimelineResponse = {
  date: string;
  stats: {
    bookingsTotal: number;
    bookingsCompleted: number;
    dcmsVisitsTotal: number;
    dcmsVisitsCompleted: number;
    dcmsDueCount: number;
    dueWashCount: number;
    executionCount: number;
    delayedCount: number;
  };
  summary?: ServiceUpdatesSummary;
  items: TimelineItem[];
};

async function fetchOperationsTimeline() {
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(`/api/operations/timeline?date=${today}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load operations timeline");
  return res.json() as Promise<TimelineResponse>;
}

async function fetchOpenComplaints() {
  const res = await fetch("/api/complaints?status=open&limit=20", { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const REFRESH_MS = 30000;

const CHANNEL_LABEL: Record<TimelineItem["channel"], string> = {
  booking: "Booking",
  dcms_visit: "DCMS visit",
  dcms_due: "DCMS due",
  due_wash: "Due wash",
  execution: "Execution",
};

function channelClass(channel: TimelineItem["channel"]) {
  if (channel === "execution") return "text-emerald-300 border-emerald-500/30";
  if (channel === "dcms_visit" || channel === "dcms_due") return "text-sky-300 border-sky-500/30";
  if (channel === "due_wash") return "text-amber-300 border-amber-500/30";
  return "text-primary border-primary/30";
}

function liveItems(items: TimelineItem[]) {
  const activeStatuses = new Set([
    "scheduled", "started", "confirmed", "en_route", "in_progress", "pending", "overdue",
  ]);
  return items.filter(i => activeStatuses.has(i.status));
}

export default function OperationsWall() {
  const { data: timeline, dataUpdatedAt } = useQuery({
    queryKey: ["ops-wall-timeline"],
    queryFn: fetchOperationsTimeline,
    refetchInterval: REFRESH_MS,
  });
  const { data: complaintsData } = useQuery({
    queryKey: ["ops-wall-complaints"],
    queryFn: fetchOpenComplaints,
    refetchInterval: REFRESH_MS,
  });
  const { data: staffData } = useListStaff({ isActive: true } as any, {
    query: { queryKey: ["ops-wall-staff"], refetchInterval: REFRESH_MS },
  });

  const stats = timeline?.stats;
  const summary = timeline?.summary;
  const allItems = timeline?.items ?? [];
  const bookings = allItems.filter(i => i.channel === "booking");
  const scheduled = bookings.filter(b => b.status === "scheduled" || b.status === "confirmed");
  const enRoute = bookings.filter(b => b.status === "en_route");
  const inProgress = bookings.filter(b => b.status === "in_progress");
  const completed = bookings.filter(b => b.status === "completed");
  const delayed = stats?.delayedCount ?? 0;
  const dcmsDue = allItems.filter(i => i.channel === "dcms_due");
  const dcmsVisits = allItems.filter(i => i.channel === "dcms_visit");

  const openComplaints = (complaintsData?.data ?? []) as any[];
  const activeStaff = (staffData ?? []) as any[];

  const totalWork = allItems.length;
  const completedWork = completed.length + dcmsVisits.filter(v => v.status === "completed").length;

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "—";

  const now = new Date();

  return (
    <div className="min-h-screen bg-secondary text-white p-6 space-y-6" data-testid="operations-wall">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl tracking-tight">Service Updates</h1>
            <p className="text-white/40 text-sm mt-0.5">
              Read-only ops view · aggregates assignments &amp; executions · {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <Link href="/admin/assign-services" className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 rounded-lg text-primary transition-colors text-xs">
            Assign Services
          </Link>
          <Wifi size={14} className="text-green-400" />
          <span>Last updated {lastRefresh}</span>
          <span className="text-white/20">·</span>
          <span>Auto-refresh {REFRESH_MS / 1000}s</span>
          <Link href="/admin/dashboard" className="ml-4 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors text-xs">
            ← Back to Admin
          </Link>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Pending", count: summary.pending, href: "/admin/assign-services" },
            { label: "Assigned", count: summary.assigned, href: "/admin/assign-services" },
            { label: "Scheduled", count: summary.scheduled },
            { label: "Started", count: summary.started },
            { label: "Completed", count: summary.completed },
            { label: "Missed", count: summary.missed },
            { label: "Cancelled", count: summary.cancelled },
          ].map(({ label, count, href }) => (
            href ? (
              <Link key={label} href={href} className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                <p className="font-display font-bold text-2xl tabular-nums">{count}</p>
                <p className="text-xs text-white/50 mt-1">{label}</p>
              </Link>
            ) : (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-display font-bold text-2xl tabular-nums">{count}</p>
                <p className="text-xs text-white/50 mt-1">{label}</p>
              </div>
            )
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
        {[
          { label: "Executions", count: stats?.executionCount ?? 0, color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", icon: Activity },
          { label: "Bookings", count: stats?.bookingsTotal ?? 0, color: "bg-sky-500/20 border-sky-500/30 text-sky-300", icon: Calendar },
          { label: "DCMS visits", count: stats?.dcmsVisitsTotal ?? 0, color: "bg-indigo-500/20 border-indigo-500/30 text-indigo-300", icon: Sparkles },
          { label: "DCMS due", count: stats?.dcmsDueCount ?? 0, color: "bg-violet-500/20 border-violet-500/30 text-violet-300", icon: Clock },
          { label: "In progress", count: inProgress.length + enRoute.length, color: "bg-primary/20 border-primary/30 text-primary", icon: Activity },
          { label: "Completed", count: completedWork, color: "bg-green-500/20 border-green-500/30 text-green-300", icon: CheckCircle2 },
          { label: "Delayed", count: delayed, color: delayed > 0 ? "bg-red-500/20 border-red-500/30 text-red-300" : "bg-white/5 border-white/10 text-white/50", icon: AlertTriangle },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`} data-testid={`wall-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            <Icon size={18} className="mb-2" />
            <p className="font-display font-bold text-4xl tabular-nums">{count}</p>
            <p className="text-xs mt-1 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      {totalWork > 0 && (
        <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
          <CompletionRing value={completedWork} max={totalWork} size={72} />
          <div>
            <p className="font-display font-bold text-2xl">{completedWork}/{totalWork} work items today</p>
            <p className="text-white/40 text-sm">
              {bookings.length} bookings · {dcmsVisits.length} DCMS visits · {dcmsDue.length} DCMS due · {stats?.dueWashCount ?? 0} legacy due washes
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-display font-bold text-lg text-white/80 flex items-center gap-2">
            <Activity size={16} className="text-primary" /> Unified timeline
          </h2>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {liveItems(allItems).slice(0, 25).map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3" data-testid={`wall-job-${item.id}`}>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.customerName ?? `Customer #${item.customerId}`}</p>
                  <p className="text-xs text-white/40 capitalize truncate">
                    {item.workType}
                    {item.assetLabel ? ` · ${item.assetLabel}` : ""}
                    {item.staffName ? ` · ${item.staffName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant="outline" className={`text-[10px] ${channelClass(item.channel)}`}>
                    {CHANNEL_LABEL[item.channel]}
                  </Badge>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
            {allItems.length === 0 && (
              <div className="text-center py-8 text-white/30 text-sm">No work scheduled for today</div>
            )}
          </div>
        </div>

        <div className="space-y-5">
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
