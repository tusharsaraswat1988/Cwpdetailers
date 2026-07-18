import { useMemo, useState } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useListStaff } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format, parseISO, isValid, differenceInMinutes } from "date-fns";
import {
  AlertTriangle, RefreshCw, Download, ClipboardCheck, AlertCircle,
  Users, User, Clock, CheckCircle2, Camera, ListChecks, MapPinOff,
  PenTool, Flame, ShieldAlert, Receipt, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PageTemplate,
  FilterBar,
  DataTable,
  StatusBadge,
  KpiRow,
  BulkActionBar,
  EntityDrawer,
  Timeline,
  ActivityFeed,
  EmptyState,
  OfflineState,
  type Column,
  type KpiItem,
  type TimelineEvent,
  type ActivityItem,
} from "@/components/shared";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  fetchJobs,
  fetchJobTimeline,
  fetchOpenComplaints,
  fetchExecutionDetail,
  type Job,
  type JobPriority,
  type Complaint,
  type ExecutionDetailWithLocation,
} from "@/features/operations-console/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type HealthTone = "healthy" | "attention" | "critical";

type QualitySummary = {
  beforePhotos: number;
  afterPhotos: number;
  checklistTotal: number;
  checklistDone: number;
  hasGps: boolean;
  hasSignature: boolean;
};

type QueueRow = Job & {
  quality?: QualitySummary;
  health: HealthTone;
  isOverdue: boolean;
  isMissingBeforePhoto: boolean;
  isChecklistPending: boolean;
  isGpsMissing: boolean;
  isSignatureMissing: boolean;
};

const TODAY = () => new Date().toISOString().slice(0, 10);
const REFRESH_MS = 60_000;
const QUALITY_CANDIDATE_STATUSES = new Set(["started", "paused", "resumed", "completed"]);

const HEALTH_META: Record<HealthTone, { label: string; dot: string; tone: "success" | "warning" | "destructive" }> = {
  healthy: { label: "Healthy", dot: "bg-green-500", tone: "success" },
  attention: { label: "Attention", dot: "bg-amber-500", tone: "warning" },
  critical: { label: "Critical", dot: "bg-red-500", tone: "destructive" },
};

const FIELD_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "started", label: "Started" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "h:mm a") : "—";
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, h:mm a") : "—";
}

function liveDuration(job: Job): string | null {
  if (!job.startedAt) return null;
  const start = parseISO(job.startedAt);
  if (!isValid(start)) return null;
  const end = job.completedAt ? parseISO(job.completedAt) : new Date();
  const mins = Math.max(0, differenceInMinutes(end, start));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function isJobOverdue(job: Job): boolean {
  if (!["scheduled", "ready_for_execution"].includes(job.fieldStatus)) return false;
  if (!job.scheduledTime) return false;
  const scheduled = new Date(`${job.scheduledDate}T${job.scheduledTime}:00`);
  return Date.now() - scheduled.getTime() > 30 * 60 * 1000;
}

function summarize(detail: ExecutionDetailWithLocation | undefined): QualitySummary | undefined {
  if (!detail) return undefined;
  return {
    beforePhotos: detail.photos.filter(p => p.kind === "before").length,
    afterPhotos: detail.photos.filter(p => p.kind === "after").length,
    checklistTotal: detail.checklist?.length ?? 0,
    checklistDone: detail.checklist?.filter(c => c.isCompleted).length ?? 0,
    hasGps: (detail.locationLogs?.length ?? 0) > 0,
    hasSignature: !!detail.customerSignatureUrl,
  };
}

function computeHealth(row: {
  job: Job;
  isOverdue: boolean;
  quality?: QualitySummary;
}): HealthTone {
  const { job, isOverdue, quality } = row;
  if (job.fieldStatus === "missed" || job.isEscalated) return "critical";
  if (isOverdue) return "critical";
  if (job.opsStatus === "pending_quality_review" || job.opsStatus === "reopened") return "attention";
  if (job.priority === "urgent" || job.priority === "high") return "attention";
  if (job.fieldStatus === "completed" && quality) {
    if (quality.beforePhotos === 0 || !quality.hasSignature) return "attention";
    if (quality.checklistTotal > 0 && quality.checklistDone < quality.checklistTotal) return "attention";
  }
  return "healthy";
}

function priorityTone(p: JobPriority): "destructive" | "warning" | "neutral" {
  if (p === "urgent") return "destructive";
  if (p === "high") return "warning";
  return "neutral";
}

function ageLabel(iso: string): string {
  const mins = differenceInMinutes(new Date(), parseISO(iso));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function jobEventIcon(eventType: string) {
  if (eventType.includes("ESCALAT")) return Flame;
  if (eventType.includes("APPROV")) return CheckCircle2;
  if (eventType.includes("BILLING")) return Receipt;
  if (eventType.includes("REOPEN")) return RefreshCw;
  if (eventType.includes("QUALITY")) return ShieldAlert;
  if (eventType.includes("CANCEL")) return AlertCircle;
  return ClipboardCheck;
}

function jobEventTone(eventType: string): TimelineEvent["tone"] {
  if (eventType.includes("CANCEL") || eventType.includes("MISS")) return "destructive";
  if (eventType.includes("BILLING") || eventType.includes("APPROV") || eventType.includes("COMPLET")) return "success";
  if (eventType.includes("ESCALAT") || eventType.includes("REOPEN")) return "warning";
  return "default";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OperationsControlCenter() {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(TODAY());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [needsAttentionFilter, setNeedsAttentionFilter] = useState<string | null>(null);
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | JobPriority>("all");
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [drawerJobId, setDrawerJobId] = useState<number | null>(null);
  const [drawerComplaintId, setDrawerComplaintId] = useState<number | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["ops-console-jobs", "all"],
    queryFn: () => fetchJobs({ queue: "all", limit: 300 }),
    refetchInterval: REFRESH_MS,
  });

  const complaintsQuery = useQuery({
    queryKey: ["ops-console-complaints"],
    queryFn: () => fetchOpenComplaints(50),
    refetchInterval: REFRESH_MS,
  });

  const { data: staffData, refetch: refetchStaff } = useListStaff({ isActive: true } as any, {
    query: { queryKey: ["ops-console-staff"], refetchInterval: REFRESH_MS },
  });

  const allStaff = (staffData ?? []) as Array<{ id: number; name: string }>;

  const todaysJobs = useMemo(
    () => (jobsQuery.data ?? []).filter(j => j.scheduledDate === date),
    [jobsQuery.data, date],
  );

  const candidateIds = useMemo(
    () => todaysJobs.filter(j => QUALITY_CANDIDATE_STATUSES.has(j.fieldStatus)).map(j => j.executionId).slice(0, 60),
    [todaysJobs],
  );

  const detailQueries = useQueries({
    queries: candidateIds.map(id => ({
      queryKey: ["ops-console-execution-detail", id],
      queryFn: () => fetchExecutionDetail(id) as Promise<ExecutionDetailWithLocation>,
      staleTime: 60_000,
    })),
  });

  const detailById = useMemo(() => {
    const map = new Map<number, ExecutionDetailWithLocation>();
    candidateIds.forEach((id, i) => {
      const d = detailQueries[i]?.data;
      if (d) map.set(id, d);
    });
    return map;
  }, [candidateIds, detailQueries]);

  const queueRows: QueueRow[] = useMemo(() => {
    return todaysJobs.map(job => {
      const quality = summarize(detailById.get(job.executionId));
      const isOverdue = isJobOverdue(job);
      const health = computeHealth({ job, isOverdue, quality });
      return {
        ...job,
        quality,
        health,
        isOverdue,
        isMissingBeforePhoto: job.fieldStatus === "completed" && !!quality && quality.beforePhotos === 0,
        isChecklistPending: !!quality && quality.checklistTotal > 0 && quality.checklistDone < quality.checklistTotal,
        isGpsMissing: !!job.startedAt && !!quality && !quality.hasGps,
        isSignatureMissing: job.fieldStatus === "completed" && !!quality && !quality.hasSignature,
      };
    });
  }, [todaysJobs, detailById]);

  const needsAttention = useMemo(() => {
    const escalated = queueRows.filter(r => r.isEscalated);
    const missed = queueRows.filter(r => r.fieldStatus === "missed");
    const overdue = queueRows.filter(r => r.isOverdue);
    const missingPhotos = queueRows.filter(r => r.isMissingBeforePhoto);
    const waitingApproval = queueRows.filter(r => r.opsStatus === "pending_quality_review");
    const readyForBilling = queueRows.filter(r => r.opsStatus === "ready_for_billing");
    return { escalated, missed, overdue, missingPhotos, waitingApproval, readyForBilling };
  }, [queueRows]);

  const staffState = useMemo(() => {
    const byStaff = new Map<number, QueueRow[]>();
    for (const row of queueRows) {
      const list = byStaff.get(row.assignedStaffId) ?? [];
      list.push(row);
      byStaff.set(row.assignedStaffId, list);
    }
    return allStaff.map(s => {
      const jobs = byStaff.get(s.id) ?? [];
      const executing = jobs.filter(j => j.fieldStatus === "started" || j.fieldStatus === "resumed");
      const paused = jobs.filter(j => j.fieldStatus === "paused");
      const notStarted = jobs.filter(j => ["scheduled", "ready_for_execution"].includes(j.fieldStatus));
      let state: "executing" | "paused" | "assigned" | "idle" = "idle";
      if (executing.length > 0) state = "executing";
      else if (paused.length > 0) state = "paused";
      else if (notStarted.length > 0) state = "assigned";
      const since = executing.length > 0
        ? executing.reduce<string | null>((min, j) => (!min || (j.startedAt && j.startedAt < min) ? j.startedAt : min), null)
        : null;
      return { id: s.id, name: s.name, state, jobCount: jobs.length, since };
    }).sort((a, b) => {
      const order = { executing: 0, paused: 1, assigned: 2, idle: 3 };
      return order[a.state] - order[b.state];
    });
  }, [allStaff, queueRows]);

  const filteredRows = useMemo(() => {
    let list = queueRows;
    if (needsAttentionFilter) {
      switch (needsAttentionFilter) {
        case "escalated": list = list.filter(r => r.isEscalated); break;
        case "missed": list = list.filter(r => r.fieldStatus === "missed"); break;
        case "overdue": list = list.filter(r => r.isOverdue); break;
        case "missingPhotos": list = list.filter(r => r.isMissingBeforePhoto); break;
        case "waitingApproval": list = list.filter(r => r.opsStatus === "pending_quality_review"); break;
        case "readyForBilling": list = list.filter(r => r.opsStatus === "ready_for_billing"); break;
      }
    }
    if (statusFilter !== "all") list = list.filter(r => r.fieldStatus === statusFilter);
    if (technicianFilter !== "all") list = list.filter(r => String(r.assignedStaffId) === technicianFilter);
    if (priorityFilter !== "all") list = list.filter(r => r.priority === priorityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.customerName.toLowerCase().includes(q)
        || r.staffName.toLowerCase().includes(q)
        || (r.assetLabel ?? "").toLowerCase().includes(q)
        || String(r.id).includes(q),
      );
    }
    return list;
  }, [queueRows, needsAttentionFilter, statusFilter, technicianFilter, priorityFilter, search]);

  const hasActiveFilters = !!needsAttentionFilter || statusFilter !== "all" || technicianFilter !== "all" || priorityFilter !== "all" || !!search;

  const clearFilters = () => {
    setNeedsAttentionFilter(null);
    setStatusFilter("all");
    setTechnicianFilter("all");
    setPriorityFilter("all");
    setSearch("");
  };

  const applyAttentionFilter = (id: string) => {
    setNeedsAttentionFilter(prev => (prev === id ? null : id));
    setStatusFilter("all");
    setSelectedKeys([]);
  };

  const refreshAll = () => {
    void jobsQuery.refetch();
    void complaintsQuery.refetch();
    void refetchStaff();
    candidateIds.forEach(id => {
      void queryClient.invalidateQueries({ queryKey: ["ops-console-execution-detail", id] });
    });
  };

  const exportCsv = () => {
    const rows = filteredRows;
    const header = ["Job ID", "Customer", "Technician", "Field Status", "Ops Status", "Priority", "Scheduled", "Started", "Duration", "Health"];
    const lines = rows.map(r => [
      r.jobId, r.customerName, r.staffName, r.fieldStatus, r.opsStatus, r.priority,
      `${r.scheduledDate} ${r.scheduledTime ?? ""}`.trim(), fmtTime(r.startedAt), liveDuration(r) ?? "", HEALTH_META[r.health].label,
    ]);
    const csv = [header, ...lines].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operations-queue-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lastUpdated = jobsQuery.data ? new Date() : null;
  const updatedAgo = jobsQuery.isFetching ? "Refreshing…" : lastUpdated ? "Just now" : "—";

  const drawerJob = useMemo(
    () => queueRows.find(r => r.jobId === drawerJobId) ?? null,
    [queueRows, drawerJobId],
  );

  const jobTimelineQuery = useQuery({
    queryKey: ["ops-console-job-timeline", drawerJobId],
    queryFn: () => fetchJobTimeline(drawerJobId!),
    enabled: drawerJobId != null,
  });

  const drawerDetail = drawerJobId != null ? detailById.get(drawerJobId) : undefined;
  const drawerDetailQuery = useQuery({
    queryKey: ["ops-console-execution-detail", drawerJobId],
    queryFn: () => fetchExecutionDetail(drawerJobId!) as Promise<ExecutionDetailWithLocation>,
    enabled: drawerJobId != null && !drawerDetail,
  });
  const drawerQuality = summarize(drawerDetail ?? drawerDetailQuery.data);

  const businessTimeline: TimelineEvent[] = (jobTimelineQuery.data ?? [])
    .filter(e => e.source === "field")
    .map(e => ({
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      actor: e.actorName ?? undefined,
      timestamp: fmtDateTime(e.createdAt),
      icon: jobEventIcon(e.eventType),
      tone: jobEventTone(e.eventType),
    }));

  const opsActivity: ActivityItem[] = (jobTimelineQuery.data ?? [])
    .filter(e => e.source === "ops")
    .map(e => ({
      id: e.id,
      icon: jobEventIcon(e.eventType),
      title: e.title,
      subtitle: [e.description, e.actorName].filter(Boolean).join(" · ") || undefined,
      timestamp: fmtDateTime(e.createdAt),
    }));

  const drawerComplaint = useMemo(
    () => (complaintsQuery.data?.data ?? []).find(c => c.id === drawerComplaintId) ?? null,
    [complaintsQuery.data, drawerComplaintId],
  );

  const columns: Column<QueueRow>[] = [
    {
      key: "health",
      header: "Health",
      sortable: true,
      cell: r => (
        <span className="inline-flex items-center gap-1.5" title={HEALTH_META[r.health].label}>
          <span className={`h-2 w-2 rounded-full ${HEALTH_META[r.health].dot}`} />
          <span className="text-xs text-muted-foreground hidden sm:inline">{HEALTH_META[r.health].label}</span>
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      cell: r => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-foreground truncate">{r.customerName}</p>
            {r.priority !== "normal" && r.priority !== "low" && (
              <StatusBadge status={r.priority} tone={priorityTone(r.priority)} />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {r.taskType.replace(/_/g, " ")}{r.assetLabel ? ` · ${r.assetLabel}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "technician",
      header: "Technician",
      sortable: true,
      hideable: true,
      cell: r => (
        <span className="flex items-center gap-1.5 text-sm">
          <User size={12} className="text-muted-foreground" /> {r.staffName}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: r => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={r.fieldStatus} />
          {r.opsStatus === "pending_quality_review" && <StatusBadge status="waiting" label="Waiting approval" />}
          {r.opsStatus === "ready_for_billing" && <StatusBadge status="ready" label="Ready for billing" />}
          {r.opsStatus === "reopened" && <StatusBadge status="reopened" label="Reopened" tone="warning" />}
        </div>
      ),
    },
    {
      key: "started",
      header: "Started",
      sortable: true,
      hideable: true,
      cell: r => <span className="text-sm text-muted-foreground">{fmtTime(r.startedAt)}</span>,
    },
    {
      key: "duration",
      header: "Duration",
      hideable: true,
      cell: r => {
        const d = liveDuration(r);
        if (!d) return <span className="text-muted-foreground">—</span>;
        const running = r.fieldStatus === "started" || r.fieldStatus === "resumed";
        return (
          <span className={`text-sm ${running ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {running && <Timer size={11} className="inline mr-1 -mt-0.5" />}
            {d}
          </span>
        );
      },
    },
    {
      key: "chips",
      header: "Flags",
      hideable: true,
      cell: r => (
        <div className="flex flex-wrap gap-1">
          {r.isMissingBeforePhoto && <StatusBadge status="missing" label="Missing photos" tone="warning" />}
          {r.isChecklistPending && <StatusBadge status="pending" label="Checklist pending" />}
          {r.isGpsMissing && <StatusBadge status="missing" label="GPS missing" tone="neutral" />}
          {r.isSignatureMissing && <StatusBadge status="missing" label="Signature missing" tone="warning" />}
          {r.isEscalated && <StatusBadge status="escalated" label="Escalated" />}
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      hideable: false,
      sticky: "right",
      cell: r => (
        <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={e => { e.stopPropagation(); setDrawerJobId(r.jobId); }}>
          View
        </Button>
      ),
    },
  ];

  const kpis: KpiItem[] = [
    {
      id: "escalated", label: "Escalated Jobs", value: needsAttention.escalated.length, icon: Flame,
      tone: needsAttention.escalated.length > 0 ? "destructive" : "default",
      onClick: () => applyAttentionFilter("escalated"),
    },
    {
      id: "overdue", label: "Delayed Executions", value: needsAttention.overdue.length, icon: AlertTriangle,
      tone: needsAttention.overdue.length > 0 ? "destructive" : "default",
      onClick: () => applyAttentionFilter("overdue"),
    },
    {
      id: "missed", label: "Missed Visits", value: needsAttention.missed.length, icon: AlertCircle,
      tone: needsAttention.missed.length > 0 ? "destructive" : "default",
      onClick: () => applyAttentionFilter("missed"),
    },
    {
      id: "missing-photos", label: "Missing Before Photos", value: needsAttention.missingPhotos.length, icon: Camera,
      tone: needsAttention.missingPhotos.length > 0 ? "warning" : "default",
      onClick: () => applyAttentionFilter("missingPhotos"),
    },
    {
      id: "waiting-approval", label: "Waiting Approval", value: needsAttention.waitingApproval.length, icon: ShieldAlert,
      tone: needsAttention.waitingApproval.length > 0 ? "warning" : "default",
      onClick: () => applyAttentionFilter("waitingApproval"),
    },
    {
      id: "ready-billing", label: "Ready for Billing", value: needsAttention.readyForBilling.length, icon: Receipt,
      tone: needsAttention.readyForBilling.length > 0 ? "success" : "default",
      onClick: () => applyAttentionFilter("readyForBilling"),
    },
  ];

  const isLoading = jobsQuery.isLoading;
  const isError = jobsQuery.isError;

  return (
    <PageTemplate
      title="Operations Control Center"
      description="Live field execution board — what needs attention, what's happening now, who needs help."
      breadcrumbs={[{ label: "Operations" }, { label: "Operations Control Center" }]}
      secondaryActions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/assign-services">
            <Button size="sm" variant="outline"><ClipboardCheck size={14} className="mr-1.5" /> Assign Staff</Button>
          </Link>
          <Button size="sm" variant="outline" onClick={refreshAll} disabled={jobsQuery.isFetching}>
            <RefreshCw size={14} className={`mr-1.5 ${jobsQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download size={14} className="mr-1.5" /> Export</Button>
          <Link href="/admin/complaints">
            <Button size="sm" variant="outline"><AlertCircle size={14} className="mr-1.5" /> Complaints</Button>
          </Link>
          <Link href="/admin/jobs">
            <Button size="sm" variant="outline"><Receipt size={14} className="mr-1.5" /> Ready for Billing</Button>
          </Link>
          <span className="text-xs text-muted-foreground ml-1">{updatedAgo}</span>
        </div>
      }
      stats={<KpiRow items={kpis} columns={6} />}
      filters={
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search customer, technician, vehicle, ID…"
          statusOptions={FIELD_STATUS_OPTIONS}
          statusValue={statusFilter}
          onStatusChange={setStatusFilter}
          onClearAll={hasActiveFilters ? clearFilters : undefined}
        >
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value || TODAY())}
            className="w-40"
            aria-label="Filter by date"
          />
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by technician">
              <SelectValue placeholder="Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All technicians</SelectItem>
              {allStaff.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as "all" | JobPriority)}>
            <SelectTrigger className="w-[130px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      {!isOnline ? (
        <OfflineState onRetry={refreshAll} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <ListChecks size={16} className="text-primary" /> Today&apos;s Operations Queue
            </h2>
            <DataTable
              columns={columns}
              rows={filteredRows}
              isLoading={isLoading}
              error={isError ? true : undefined}
              onRetry={() => jobsQuery.refetch()}
              rowKey={r => r.jobId}
              onRowClick={r => setDrawerJobId(r.jobId)}
              rowLabel={r => `View job #${r.jobId} for ${r.customerName}`}
              caption="Today's field execution jobs — status, technician, health and flags"
              emptyTitle={hasActiveFilters ? "No jobs match your filters" : "No field execution jobs today"}
              emptyDescription={
                hasActiveFilters
                  ? "Try a different status, technician, or priority — or clear filters."
                  : "Jobs appear here once staff are assigned via Staff Assignment."
              }
              emptyAction={hasActiveFilters ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
              selection={{ selectedKeys, onSelectionChange: setSelectedKeys, getRowKey: r => r.jobId }}
              enableColumnVisibility
            />
            <BulkActionBar
              selectedCount={selectedKeys.length}
              onClear={() => setSelectedKeys([])}
              actions={[
                {
                  id: "export-selected",
                  label: "Export Selected",
                  icon: <Download size={14} />,
                  onClick: () => {
                    const rows = filteredRows.filter(r => selectedKeys.includes(r.jobId));
                    const header = ["Job ID", "Customer", "Technician", "Status"];
                    const lines = rows.map(r => [r.jobId, r.customerName, r.staffName, r.fieldStatus]);
                    const csv = [header, ...lines].map(row => row.join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "selected-jobs.csv"; a.click();
                    URL.revokeObjectURL(url);
                  },
                },
              ]}
            />
          </div>

          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2 mb-2">
                <Users size={15} className="text-muted-foreground" /> Staff Status
                <span className="ml-auto text-sm font-semibold">{allStaff.length}</span>
              </h2>
              <div className="space-y-1.5 max-h-[26vh] overflow-y-auto pr-1">
                {staffState.length === 0 && (
                  <EmptyState title="No active staff found" />
                )}
                {staffState.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${
                        s.state === "executing" ? "bg-green-500"
                          : s.state === "paused" ? "bg-amber-500"
                          : s.state === "assigned" ? "bg-sky-500"
                          : "bg-muted-foreground/40"
                      }`} />
                      <span className="text-sm font-medium truncate">{s.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs text-muted-foreground">
                        {s.state === "executing" && `Executing · ${s.jobCount} job${s.jobCount > 1 ? "s" : ""}`}
                        {s.state === "paused" && "Paused"}
                        {s.state === "assigned" && `Assigned · ${s.jobCount} job${s.jobCount > 1 ? "s" : ""}`}
                        {s.state === "idle" && "Idle"}
                      </p>
                      {s.since && <p className="text-[10px] text-muted-foreground">Since {fmtTime(s.since)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-base flex items-center gap-2 mb-2">
                <AlertCircle size={15} className="text-destructive" /> Open Complaints
                <span className="ml-auto text-sm font-semibold text-destructive">{complaintsQuery.data?.data.length ?? 0}</span>
              </h2>
              <div className="space-y-1.5 max-h-[26vh] overflow-y-auto pr-1">
                {(complaintsQuery.data?.data.length ?? 0) === 0 && (
                  <p className="text-xs text-green-700 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    No open complaints
                  </p>
                )}
                {(complaintsQuery.data?.data ?? []).slice(0, 8).map((c: Complaint) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDrawerComplaintId(c.id)}
                    className="w-full text-left rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={c.priority === "high" ? "escalated" : "open"} label={c.title} tone={c.priority === "high" ? "destructive" : "warning"} />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <span className="truncate">{c.customerName ?? `Customer #${c.customerId}`}</span>
                      <span className="shrink-0 ml-2">{ageLabel(c.createdAt)} ago</span>
                    </div>
                    {c.assignedSupervisorName && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Supervisor: {c.assignedSupervisorName}</p>
                    )}
                  </button>
                ))}
              </div>
              {(complaintsQuery.data?.data.length ?? 0) > 0 && (
                <Link href="/admin/complaints" className="text-xs text-primary hover:underline mt-2 inline-block">
                  Resolve complaints →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job / Execution drawer */}
      <EntityDrawer
        open={drawerJobId != null}
        onOpenChange={open => { if (!open) setDrawerJobId(null); }}
        title={drawerJob ? `Job #${drawerJob.jobId}` : "Job"}
        description={drawerJob?.customerName}
        status={drawerJob?.fieldStatus}
        tabs={
          drawerJob
            ? [
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={drawerJob.fieldStatus} />
                        <StatusBadge status={drawerJob.opsStatus} />
                        {drawerJob.priority !== "normal" && <StatusBadge status={drawerJob.priority} tone={priorityTone(drawerJob.priority)} />}
                        {drawerJob.isEscalated && <StatusBadge status="escalated" label="Escalated" />}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-muted-foreground">Technician</p><p className="font-medium">{drawerJob.staffName}</p></div>
                        <div><p className="text-muted-foreground">Task</p><p className="font-medium">{drawerJob.taskType.replace(/_/g, " ")}</p></div>
                        <div><p className="text-muted-foreground">Scheduled</p><p className="font-medium">{drawerJob.scheduledDate} {drawerJob.scheduledTime ?? ""}</p></div>
                        <div><p className="text-muted-foreground">Vehicle / Asset</p><p className="font-medium">{drawerJob.assetLabel ?? "—"}</p></div>
                        <div><p className="text-muted-foreground">Started</p><p className="font-medium">{fmtTime(drawerJob.startedAt)}</p></div>
                        <div><p className="text-muted-foreground">Duration</p><p className="font-medium">{liveDuration(drawerJob) ?? "—"}</p></div>
                        {drawerJob.locationLabel && (
                          <div className="col-span-2"><p className="text-muted-foreground">Location</p><p className="font-medium">{drawerJob.locationLabel}</p></div>
                        )}
                        {drawerJob.isEscalated && drawerJob.escalationReason && (
                          <div className="col-span-2"><p className="text-muted-foreground">Escalation reason</p><p className="font-medium text-destructive">{drawerJob.escalationReason}</p></div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  id: "progress",
                  label: "Execution Progress",
                  content: (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_META[drawerJob.health].dot}`} />
                        <span className="font-medium">{HEALTH_META[drawerJob.health].label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-muted-foreground">Field status</p><StatusBadge status={drawerJob.fieldStatus} /></div>
                        <div><p className="text-muted-foreground">Ops status</p><StatusBadge status={drawerJob.opsStatus} /></div>
                        <div><p className="text-muted-foreground">Started</p><p className="font-medium">{fmtDateTime(drawerJob.startedAt)}</p></div>
                        <div><p className="text-muted-foreground">Completed</p><p className="font-medium">{fmtDateTime(drawerJob.completedAt)}</p></div>
                      </div>
                      {drawerQuality && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {drawerJob.isMissingBeforePhoto && <StatusBadge status="missing" label="Missing before photo" tone="warning" />}
                          {drawerJob.isChecklistPending && <StatusBadge status="pending" label="Checklist pending" />}
                          {drawerJob.isGpsMissing && <StatusBadge status="missing" label="GPS missing" tone="neutral" />}
                          {drawerJob.isSignatureMissing && <StatusBadge status="missing" label="Signature missing" tone="warning" />}
                          {!drawerJob.isMissingBeforePhoto && !drawerJob.isChecklistPending && !drawerJob.isGpsMissing && !drawerJob.isSignatureMissing && (
                            <StatusBadge status="completed" label="No quality flags" tone="success" />
                          )}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: "checklist",
                  label: "Checklist",
                  content: (() => {
                    const detail = drawerDetail ?? drawerDetailQuery.data;
                    const checklist = detail?.checklist ?? [];
                    if (drawerDetailQuery.isLoading && !detail) return <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>;
                    if (checklist.length === 0) return <EmptyState title="No checklist recorded" description="Technician hasn't submitted a checklist for this job yet." />;
                    const done = checklist.filter(c => c.isCompleted).length;
                    const pct = Math.round((done / checklist.length) * 100);
                    return (
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{done} / {checklist.length} Completed</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <ul className="space-y-1.5">
                          {checklist.map(c => (
                            <li key={c.id} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 size={14} className={c.isCompleted ? "text-green-600" : "text-muted-foreground/40"} />
                              <span className={c.isCompleted ? "" : "text-muted-foreground"}>{c.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })(),
                },
                {
                  id: "photos",
                  label: "Photos",
                  content: (() => {
                    const detail = drawerDetail ?? drawerDetailQuery.data;
                    if (drawerDetailQuery.isLoading && !detail) return <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>;
                    const photos = detail?.photos ?? [];
                    const before = photos.find(p => p.kind === "before");
                    const after = photos.find(p => p.kind === "after");
                    const extra = photos.find(p => p.kind === "proof" || p.kind === "other");
                    const slots: { label: string; photo: typeof before }[] = [
                      { label: "Before", photo: before },
                      { label: "After", photo: after },
                      { label: "Additional", photo: extra },
                    ];
                    return (
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map(slot => (
                          <div key={slot.label} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{slot.label}</p>
                            {slot.photo ? (
                              <a href={slot.photo.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-border">
                                <img src={slot.photo.url} alt={slot.label} className="h-full w-full object-cover" />
                              </a>
                            ) : (
                              <div className="aspect-square rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                                <Camera size={16} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })(),
                },
                {
                  id: "timeline",
                  label: "Timeline",
                  content: jobTimelineQuery.isLoading
                    ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
                    : <Timeline events={businessTimeline} emptyMessage="No workflow events yet." />,
                },
                {
                  id: "activity",
                  label: "Activity",
                  content: jobTimelineQuery.isLoading
                    ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
                    : <ActivityFeed items={opsActivity} emptyMessage="No dispatcher/ops activity recorded yet." />,
                },
                {
                  id: "actions",
                  label: "Actions",
                  content: (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Approvals, escalation, and billing handoff are managed in Job Orchestration to keep a single source of truth for that workflow.
                      </p>
                      <Link href="/admin/jobs" className="block">
                        <Button className="w-full" size="sm" variant="outline">
                          <ClipboardCheck size={14} className="mr-2" /> Open in Job Orchestration
                        </Button>
                      </Link>
                      {drawerJob.fieldStatus === "scheduled" && (
                        <Link href="/admin/assign-services" className="block">
                          <Button className="w-full" size="sm" variant="outline">
                            <User size={14} className="mr-2" /> Reassign in Staff Assignment
                          </Button>
                        </Link>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      {/* Complaint drawer */}
      <EntityDrawer
        open={drawerComplaintId != null}
        onOpenChange={open => { if (!open) setDrawerComplaintId(null); }}
        title={drawerComplaint ? drawerComplaint.title : "Complaint"}
        description={drawerComplaint?.customerName ?? undefined}
        status={drawerComplaint?.status}
      >
        {drawerComplaint && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge status={drawerComplaint.status} />
              <StatusBadge
                status={drawerComplaint.priority}
                label={`${drawerComplaint.priority} priority`}
                tone={drawerComplaint.priority === "high" ? "destructive" : drawerComplaint.priority === "medium" ? "warning" : "neutral"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-muted-foreground">Type</p><p className="font-medium capitalize">{drawerComplaint.type}</p></div>
              <div><p className="text-muted-foreground">Age</p><p className="font-medium">{ageLabel(drawerComplaint.createdAt)}</p></div>
              <div><p className="text-muted-foreground">Assigned supervisor</p><p className="font-medium">{drawerComplaint.assignedSupervisorName ?? "Unassigned"}</p></div>
              {drawerComplaint.relatedStaffName && (
                <div><p className="text-muted-foreground">Related staff</p><p className="font-medium">{drawerComplaint.relatedStaffName}</p></div>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Description</p>
              <p className="font-medium">{drawerComplaint.description}</p>
            </div>
            <Link href="/admin/complaints" className="block pt-2">
              <Button className="w-full" size="sm" variant="outline">Open in Complaints</Button>
            </Link>
          </div>
        )}
      </EntityDrawer>
    </PageTemplate>
  );
}
