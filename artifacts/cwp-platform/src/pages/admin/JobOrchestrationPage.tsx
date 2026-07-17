import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Can } from "@/components/Can";
import {
  PageTemplate, FilterBar, DataTable, StatusBadge, KpiRow, BulkActionBar,
  EntityDrawer, Timeline, ActivityFeed, ConfirmDialog, ActionBar, OfflineState,
  type Column, type KpiItem, type TimelineEvent, type ActivityItem, type ActionBarAction,
} from "@/components/shared";
import {
  JOBS_QUERY_KEY, approveJob, cancelJob, changeJobPriority, escalateJob,
  fetchJobTimeline, fetchJobs, markJobReadyForBilling, opsStatusLabel, opsStatusTone,
  priorityLabel, reopenJob, type Job, type JobOpsStatus, type JobPriority, type JobTimelineEntry,
} from "@/features/job-orchestration/api";
import {
  AlertTriangle, CheckCircle2, RotateCcw, XCircle, Clock, User, Wrench, GitBranch,
  ShieldCheck, Download, PlayCircle, ClipboardCheck, Receipt, Ban, FlagTriangleRight,
} from "lucide-react";

const OPS_STATUS_OPTIONS: { value: JobOpsStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "in_field", label: "In Field" },
  { value: "pending_quality_review", label: "Waiting Approval" },
  { value: "reopened", label: "Reopened" },
  { value: "approved", label: "Approved" },
  { value: "ready_for_billing", label: "Ready for Billing" },
  { value: "cancelled", label: "Cancelled" },
];

const OVERDUE_REVIEW_HOURS = 48;
const PAGE_SIZE = 15;
const PRIORITY_RANK: Record<JobPriority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function hoursSince(iso: string | null): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

/** Business-rule mirrors of artifacts/api-server/src/lib/job-orchestration/jobValidation.ts — UX gating only, not re-implemented server logic. */
const canApprove = (j: Job) => j.opsStatus === "pending_quality_review" && j.fieldStatus === "completed";
const canReopen = (j: Job) =>
  j.opsStatus !== "cancelled" && j.opsStatus !== "ready_for_billing" && j.fieldStatus === "completed" &&
  (j.opsStatus === "pending_quality_review" || j.opsStatus === "approved");
const canMarkReady = (j: Job) => j.opsStatus === "approved";
const canCancel = (j: Job) => j.opsStatus !== "cancelled" && j.opsStatus !== "ready_for_billing";
const canEscalate = (j: Job) => j.opsStatus !== "cancelled" && !j.isEscalated;
const canChangePriority = (j: Job) => j.opsStatus !== "cancelled" && j.opsStatus !== "ready_for_billing";

const TIMELINE_ICON: Record<string, TimelineEvent["icon"]> = {
  JOB_ENTERED_QUALITY_REVIEW: ClipboardCheck,
  JOB_APPROVED: CheckCircle2,
  JOB_READY_FOR_BILLING: Receipt,
  JOB_REOPENED: RotateCcw,
  JOB_ESCALATED: AlertTriangle,
  JOB_DE_ESCALATED: ShieldCheck,
  JOB_PRIORITY_CHANGED: FlagTriangleRight,
  JOB_CANCELLED: Ban,
  JOB_OWNERSHIP_CHANGED: User,
  JOB_DEPENDENCY_SET: GitBranch,
  JOB_DEPENDENCY_CLEARED: GitBranch,
};

function timelineTone(entry: JobTimelineEntry): TimelineEvent["tone"] {
  if (entry.eventType === "JOB_ESCALATED" || entry.eventType === "JOB_CANCELLED") return "destructive";
  if (entry.eventType === "JOB_APPROVED" || entry.eventType === "JOB_READY_FOR_BILLING") return "success";
  if (entry.eventType === "JOB_REOPENED" || entry.eventType === "JOB_PRIORITY_CHANGED") return "warning";
  return "default";
}

const BUSINESS_EVENT_TYPES = new Set(["JOB_ENTERED_QUALITY_REVIEW", "JOB_APPROVED", "JOB_READY_FOR_BILLING"]);

function toTimelineEvent(entry: JobTimelineEntry): TimelineEvent {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description ?? undefined,
    actor: entry.actorName ?? undefined,
    timestamp: formatDate(entry.createdAt),
    icon: TIMELINE_ICON[entry.eventType],
    tone: timelineTone(entry),
  };
}

export default function JobOrchestrationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const [search, setSearch] = useState("");
  const [opsStatusFilter, setOpsStatusFilter] = useState<JobOpsStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | "all">("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "updatedAt", direction: "desc" });
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [drawerJobId, setDrawerJobId] = useState<number | null>(null);
  const [priorityDraft, setPriorityDraft] = useState<JobPriority>("normal");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [bulkApproveConfirm, setBulkApproveConfirm] = useState(false);
  const [bulkReadyConfirm, setBulkReadyConfirm] = useState(false);

  const { data: jobs = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [...JOBS_QUERY_KEY, "all"],
    queryFn: () => fetchJobs({ queue: "all", limit: 500 }),
  });

  const dependencyMap = useMemo(() => {
    const map = new Map<number, Job>();
    for (const j of jobs) map.set(j.executionId, j);
    return map;
  }, [jobs]);

  const isBlocked = (j: Job): boolean => {
    if (j.dependsOnExecutionId == null) return false;
    const dep = dependencyMap.get(j.dependsOnExecutionId);
    if (!dep) return true;
    return dep.opsStatus !== "approved" && dep.opsStatus !== "ready_for_billing";
  };
  const isOverdue = (j: Job) => j.opsStatus === "pending_quality_review" && hoursSince(j.qualityReviewStartedAt) > OVERDUE_REVIEW_HOURS;
  const isHighPriorityActive = (j: Job) =>
    (j.priority === "high" || j.priority === "urgent") && j.opsStatus !== "cancelled" && j.opsStatus !== "ready_for_billing";

  const counts = useMemo(() => ({
    open: jobs.filter(j => j.opsStatus === "in_field" || j.opsStatus === "pending_quality_review" || j.opsStatus === "reopened").length,
    inProgress: jobs.filter(j => j.opsStatus === "in_field").length,
    completed: jobs.filter(j => j.fieldStatus === "completed").length,
    waitingApproval: jobs.filter(j => j.opsStatus === "pending_quality_review").length,
    escalated: jobs.filter(j => j.isEscalated).length,
    readyForBilling: jobs.filter(j => j.opsStatus === "ready_for_billing").length,
    reopened: jobs.filter(j => j.opsStatus === "reopened").length,
    blocked: jobs.filter(isBlocked).length,
    overdue: jobs.filter(isOverdue).length,
    highPriority: jobs.filter(isHighPriorityActive).length,
  }), [jobs, dependencyMap]);

  const technicianOptions = useMemo(
    () => Array.from(new Set(jobs.map(j => j.staffName))).sort(),
    [jobs],
  );
  const serviceOptions = useMemo(
    () => Array.from(new Set(jobs.map(j => j.taskType))).sort(),
    [jobs],
  );

  const toggleQuickFilter = (id: string) => {
    setQuickFilters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPage(1);
  };

  const rows = useMemo(() => {
    let list = jobs;
    if (opsStatusFilter !== "all") list = list.filter(j => j.opsStatus === opsStatusFilter);
    if (priorityFilter !== "all") list = list.filter(j => j.priority === priorityFilter);
    if (technicianFilter !== "all") list = list.filter(j => j.staffName === technicianFilter);
    if (serviceFilter !== "all") list = list.filter(j => j.taskType === serviceFilter);
    if (quickFilters.has("escalated")) list = list.filter(j => j.isEscalated);
    if (quickFilters.has("blocked")) list = list.filter(isBlocked);
    if (quickFilters.has("ready")) list = list.filter(j => j.opsStatus === "ready_for_billing");
    if (quickFilters.has("overdue")) list = list.filter(isOverdue);
    if (quickFilters.has("highPriority")) list = list.filter(isHighPriorityActive);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(j =>
        j.customerName?.toLowerCase().includes(q) ||
        j.staffName?.toLowerCase().includes(q) ||
        j.taskType?.toLowerCase().includes(q) ||
        String(j.jobId).includes(q) ||
        String(j.executionId).includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "jobId") cmp = a.jobId - b.jobId;
      else if (sort.key === "customer") cmp = a.customerName.localeCompare(b.customerName);
      else if (sort.key === "priority") cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else if (sort.key === "status") cmp = a.opsStatus.localeCompare(b.opsStatus);
      else if (sort.key === "updatedAt") cmp = a.updatedAt.localeCompare(b.updatedAt);
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [jobs, opsStatusFilter, priorityFilter, technicianFilter, serviceFilter, quickFilters, search, sort, dependencyMap]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );

  const drawerJob = useMemo(() => jobs.find(j => j.id === drawerJobId) ?? null, [jobs, drawerJobId]);

  const openDrawer = (job: Job) => {
    setDrawerJobId(job.id);
    setPriorityDraft(job.priority);
  };

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: [...JOBS_QUERY_KEY, "timeline", drawerJobId],
    queryFn: () => fetchJobTimeline(drawerJobId!),
    enabled: drawerJobId != null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });

  const onMutationError = (e: Error) => toast({ title: "Action failed", description: e.message, variant: "destructive" });
  const onMutationSuccess = (job: Job, verb: string) => {
    invalidate();
    toast({ title: "Updated", description: `Job #${job.jobId} ${verb}.` });
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveJob(id),
    onSuccess: (job) => onMutationSuccess(job, "approved"),
    onError: onMutationError,
  });
  const reopenMutation = useMutation({
    mutationFn: (id: number) => reopenJob(id),
    onSuccess: (job) => onMutationSuccess(job, "reopened"),
    onError: onMutationError,
  });
  const readyMutation = useMutation({
    mutationFn: (id: number) => markJobReadyForBilling(id),
    onSuccess: (job) => onMutationSuccess(job, "marked ready for billing"),
    onError: onMutationError,
  });
  const escalateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => escalateJob(id, reason),
    onSuccess: (job) => { onMutationSuccess(job, "escalated"); setEscalateOpen(false); setEscalateReason(""); },
    onError: onMutationError,
  });
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => cancelJob(id, reason),
    onSuccess: (job) => { onMutationSuccess(job, "cancelled"); setCancelOpen(false); setCancelReason(""); },
    onError: onMutationError,
  });
  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: number; priority: JobPriority }) => changeJobPriority(id, priority),
    onSuccess: (job) => onMutationSuccess(job, "priority updated"),
    onError: onMutationError,
  });

  const hasActiveFilters =
    search !== "" || opsStatusFilter !== "all" || priorityFilter !== "all" ||
    technicianFilter !== "all" || serviceFilter !== "all" || quickFilters.size > 0;

  const clearFilters = () => {
    setSearch(""); setOpsStatusFilter("all"); setPriorityFilter("all");
    setTechnicianFilter("all"); setServiceFilter("all"); setQuickFilters(new Set());
    setPage(1);
  };

  const exportCsv = (list: Job[]) => {
    const header = ["Job ID", "Customer", "Service", "Technician", "Priority", "Status", "Ready for Billing", "Updated"];
    const lines = list.map(j => [
      j.jobId, j.customerName, j.taskType, j.staffName, priorityLabel(j.priority),
      opsStatusLabel(j.opsStatus), j.opsStatus === "ready_for_billing" ? "Yes" : "No", j.updatedAt,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-orchestration-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedJobs = useMemo(
    () => rows.filter(j => selectedKeys.includes(j.id)),
    [rows, selectedKeys],
  );

  const runBulk = async (
    mutate: (id: number) => Promise<Job>,
    predicate: (j: Job) => boolean,
    verb: string,
  ) => {
    const eligible = selectedJobs.filter(predicate);
    const skipped = selectedJobs.length - eligible.length;
    if (eligible.length === 0) {
      toast({ title: "No eligible jobs", description: `None of the selected jobs can be ${verb} right now.`, variant: "destructive" });
      return;
    }
    await Promise.allSettled(eligible.map(j => mutate(j.id)));
    invalidate();
    toast({
      title: `${eligible.length} job(s) ${verb}`,
      description: skipped > 0 ? `${skipped} job(s) skipped — not eligible.` : undefined,
    });
    setSelectedKeys([]);
  };

  // ---- Health chips (row + drawer) ------------------------------------------------
  function HealthChips({ job }: { job: Job }) {
    const chips: { key: string; status: string; label?: string; tone?: "destructive" | "warning" | "info" | "success" }[] = [];
    if (job.isEscalated) chips.push({ key: "escalated", status: "escalated" });
    if (isBlocked(job)) chips.push({ key: "blocked", status: "blocked" });
    if (job.opsStatus === "reopened") chips.push({ key: "reopened", status: "reopened", tone: "warning" });
    if (job.dependsOnExecutionId != null) chips.push({ key: "dependency", status: "dependency", label: "Dependency", tone: "info" });
    if (job.opsStatus === "ready_for_billing") chips.push({ key: "ready", status: "ready_for_billing", label: "Ready", tone: "success" });
    if (chips.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {chips.map(c => <StatusBadge key={c.key} status={c.status} label={c.label} tone={c.tone} />)}
      </div>
    );
  }

  const columns: Column<Job>[] = [
    {
      key: "jobId", header: "Job ID", sortable: true,
      cell: j => <span className="font-medium text-foreground">#{j.jobId}</span>,
    },
    {
      key: "customer", header: "Customer", sortable: true,
      cell: j => (
        <div>
          <p className="font-medium text-foreground">{j.customerName}</p>
          <p className="text-xs text-muted-foreground">{j.locationLabel ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "service", header: "Service", hideable: true,
      cell: j => (
        <div>
          <p className="text-foreground capitalize">{j.taskType?.replace(/_/g, " ")}</p>
          {j.assetLabel && <p className="text-xs text-muted-foreground">{j.assetLabel}</p>}
        </div>
      ),
    },
    {
      key: "technician", header: "Technician", hideable: true,
      cell: j => (
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <User size={12} className="text-muted-foreground" /> {j.staffName}
        </span>
      ),
    },
    {
      key: "priority", header: "Priority", sortable: true,
      cell: j => (
        <StatusBadge
          status={j.priority}
          label={priorityLabel(j.priority)}
          tone={j.priority === "urgent" || j.priority === "high" ? "destructive" : j.priority === "low" ? "neutral" : "info"}
        />
      ),
    },
    {
      key: "status", header: "Current Status", sortable: true,
      cell: j => <StatusBadge status={j.opsStatus} label={opsStatusLabel(j.opsStatus)} tone={opsStatusTone(j.opsStatus)} />,
    },
    {
      key: "approval", header: "Approval",
      cell: j => {
        if (j.opsStatus === "cancelled") return <span className="text-muted-foreground text-xs">—</span>;
        if (j.approvedAt) return <StatusBadge status="approved" label={`Approved ${formatDate(j.approvedAt)}`} tone="success" />;
        if (j.opsStatus === "pending_quality_review") return <StatusBadge status="pending" label="Pending" tone="warning" />;
        return <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      key: "health", header: "Health", hideable: true,
      cell: j => <HealthChips job={j} />,
    },
    {
      key: "updated", header: "Last Updated", sortable: true, hideable: true,
      cell: j => <span className="text-xs text-muted-foreground">{formatDate(j.updatedAt)}</span>,
    },
    {
      key: "actions", header: "", align: "right", hideable: false, sticky: "right",
      cell: j => (
        <div className="flex items-center justify-end gap-1.5">
          {canApprove(j) && (
            <Button
              size="sm" variant="outline" className="h-7 px-2 text-xs"
              disabled={approveMutation.isPending}
              onClick={(e) => { e.stopPropagation(); approveMutation.mutate(j.id); }}
            >
              <CheckCircle2 size={12} className="mr-1" /> Approve
            </Button>
          )}
          {canMarkReady(j) && (
            <Button
              size="sm" variant="outline" className="h-7 px-2 text-xs"
              disabled={readyMutation.isPending}
              onClick={(e) => { e.stopPropagation(); readyMutation.mutate(j.id); }}
            >
              <Receipt size={12} className="mr-1" /> Ready
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); openDrawer(j); }}>
            View
          </Button>
        </div>
      ),
    },
  ];

  const needsAttention: KpiItem[] = [
    {
      id: "waiting-approval", label: "Waiting Approval", value: counts.waitingApproval, icon: ClipboardCheck,
      tone: counts.waitingApproval > 0 ? "warning" : "default",
      onClick: () => { setOpsStatusFilter("pending_quality_review"); setQuickFilters(new Set()); setPage(1); },
    },
    {
      id: "escalated", label: "Escalated", value: counts.escalated, icon: AlertTriangle,
      tone: counts.escalated > 0 ? "destructive" : "default",
      onClick: () => { setOpsStatusFilter("all"); toggleQuickFilter("escalated"); },
    },
    {
      id: "blocked", label: "Blocked", value: counts.blocked, icon: GitBranch,
      tone: counts.blocked > 0 ? "destructive" : "default",
      onClick: () => { setOpsStatusFilter("all"); toggleQuickFilter("blocked"); },
    },
    {
      id: "overdue", label: "Overdue Review", value: counts.overdue, icon: Clock,
      tone: counts.overdue > 0 ? "destructive" : "default",
      onClick: () => { setOpsStatusFilter("all"); toggleQuickFilter("overdue"); },
    },
    {
      id: "reopened", label: "Reopened", value: counts.reopened, icon: RotateCcw,
      tone: counts.reopened > 0 ? "warning" : "default",
      onClick: () => { setOpsStatusFilter("reopened"); setQuickFilters(new Set()); setPage(1); },
    },
    {
      id: "ready-for-billing", label: "Ready for Billing", value: counts.readyForBilling, icon: Receipt,
      tone: counts.readyForBilling > 0 ? "success" : "default",
      prominent: counts.readyForBilling > 0,
      onClick: () => { setOpsStatusFilter("ready_for_billing"); setQuickFilters(new Set()); setPage(1); },
    },
  ];

  const kpis: KpiItem[] = [
    { id: "open", label: "Open Jobs", value: counts.open, icon: PlayCircle, onClick: () => { clearFilters(); setOpsStatusFilter("in_field"); } },
    { id: "in-progress", label: "In Progress", value: counts.inProgress, icon: Wrench, onClick: () => { clearFilters(); setOpsStatusFilter("in_field"); } },
    { id: "completed", label: "Completed", value: counts.completed, icon: CheckCircle2 },
    { id: "high-priority", label: "High Priority", value: counts.highPriority, icon: FlagTriangleRight, tone: counts.highPriority > 0 ? "warning" : "default", onClick: () => { setOpsStatusFilter("all"); toggleQuickFilter("highPriority"); } },
  ];

  const businessTimeline = timeline.filter(t => t.source === "field" || BUSINESS_EVENT_TYPES.has(t.eventType)).map(toTimelineEvent);
  const activityTimeline: ActivityItem[] = timeline
    .filter(t => !(t.source === "field" || BUSINESS_EVENT_TYPES.has(t.eventType)))
    .map(t => ({
      id: t.id,
      icon: TIMELINE_ICON[t.eventType] ?? User,
      title: t.title,
      subtitle: [t.description, t.actorName ? `by ${t.actorName}` : null].filter(Boolean).join(" — ") || undefined,
      timestamp: formatDate(t.createdAt),
    }));

  const approvalHistory = timeline.filter(t => t.eventType === "JOB_APPROVED");
  const latestApproval = approvalHistory[approvalHistory.length - 1];
  const previousApprovals = approvalHistory.slice(0, -1);

  const dependencyJob = drawerJob?.dependsOnExecutionId != null ? dependencyMap.get(drawerJob.dependsOnExecutionId) : undefined;

  const drawerActions: ActionBarAction[] = drawerJob ? [
    ...(canApprove(drawerJob) ? [{ id: "approve", label: "Approve", icon: <CheckCircle2 size={14} />, onClick: () => approveMutation.mutate(drawerJob.id), disabled: approveMutation.isPending }] : []),
    ...(canMarkReady(drawerJob) ? [{ id: "ready", label: "Mark Ready for Billing", icon: <Receipt size={14} />, onClick: () => readyMutation.mutate(drawerJob.id), disabled: readyMutation.isPending }] : []),
    ...(canReopen(drawerJob) ? [{ id: "reopen", label: "Reopen", icon: <RotateCcw size={14} />, onClick: () => reopenMutation.mutate(drawerJob.id), disabled: reopenMutation.isPending }] : []),
    ...(canEscalate(drawerJob) ? [{ id: "escalate", label: "Escalate", icon: <AlertTriangle size={14} />, variant: "secondary" as const, onClick: () => setEscalateOpen(true) }] : []),
    ...(canCancel(drawerJob) ? [{ id: "cancel", label: "Cancel Job", icon: <XCircle size={14} />, variant: "destructive" as const, onClick: () => setCancelOpen(true) }] : []),
  ] : [];

  return (
    <PageTemplate
      title="Job Orchestration"
      description="Operations decision center — approvals, escalations, reopens, dependencies and the ready-for-billing handoff."
      breadcrumbs={[{ label: "Operations" }, { label: "Job Orchestration" }]}
      primaryAction={{
        label: isFetching ? "Refreshing…" : "Refresh",
        onClick: () => { void refetch(); },
        testId: "job-orchestration-refresh",
      }}
      secondaryActions={
        <Button variant="outline" size="sm" onClick={() => exportCsv(rows)} data-testid="job-orchestration-export">
          <Download size={14} className="mr-1.5" /> Export
        </Button>
      }
      stats={
        <div className="space-y-3">
          <KpiRow items={needsAttention} isLoading={isLoading} columns={6} />
          <KpiRow items={kpis} isLoading={isLoading} columns={4} />
        </div>
      }
      filters={
        <FilterBar
          search={search}
          onSearchChange={v => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search by job ID, customer, technician, service…"
          statusOptions={OPS_STATUS_OPTIONS}
          statusValue={opsStatusFilter}
          onStatusChange={v => { setOpsStatusFilter(v as JobOpsStatus | "all"); setPage(1); }}
          quickFilters={[
            { id: "escalated", label: "Escalated", active: quickFilters.has("escalated"), onClick: () => toggleQuickFilter("escalated") },
            { id: "blocked", label: "Blocked", active: quickFilters.has("blocked"), onClick: () => toggleQuickFilter("blocked") },
            { id: "ready", label: "Ready for Billing", active: quickFilters.has("ready"), onClick: () => toggleQuickFilter("ready") },
            { id: "overdue", label: "Overdue Review", active: quickFilters.has("overdue"), onClick: () => toggleQuickFilter("overdue") },
            { id: "highPriority", label: "High Priority", active: quickFilters.has("highPriority"), onClick: () => toggleQuickFilter("highPriority") },
          ]}
          onClearAll={hasActiveFilters ? clearFilters : undefined}
        >
          <Select value={priorityFilter} onValueChange={v => { setPriorityFilter(v as JobPriority | "all"); setPage(1); }}>
            <SelectTrigger className="w-36" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={technicianFilter} onValueChange={v => { setTechnicianFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40" data-testid="filter-technician"><SelectValue placeholder="Technician" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {technicianOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={v => { setServiceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40" data-testid="filter-service"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {serviceOptions.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      {!isOnline ? (
        <OfflineState onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={pagedRows}
            isLoading={isLoading}
            error={isError ? true : undefined}
            onRetry={() => refetch()}
            rowKey={j => j.id}
            onRowClick={openDrawer}
            rowLabel={j => `View job #${j.jobId} for ${j.customerName}`}
            caption="Job orchestration — lifecycle, approvals, escalations and billing handoff"
            emptyTitle={hasActiveFilters ? "No jobs match your filters" : "No jobs in orchestration yet"}
            emptyDescription={hasActiveFilters ? "Try a different search or filter, or clear filters to see all jobs." : "Jobs enter here once field execution completes."}
            emptyAction={hasActiveFilters ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
            sort={{ key: sort.key, direction: sort.direction, onSortChange: (key, direction) => setSort({ key, direction }) }}
            selection={{ selectedKeys, onSelectionChange: setSelectedKeys }}
            enableColumnVisibility
            pagination={{ page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }}
          />

          <BulkActionBar
            selectedCount={selectedKeys.length}
            onClear={() => setSelectedKeys([])}
            actions={[
              { id: "approve", label: "Approve", icon: <CheckCircle2 size={14} />, onClick: () => setBulkApproveConfirm(true) },
              { id: "reopen", label: "Reopen", icon: <RotateCcw size={14} />, onClick: () => runBulk((id) => reopenMutation.mutateAsync(id), canReopen, "reopened") },
              { id: "ready", label: "Mark Ready for Billing", icon: <Receipt size={14} />, onClick: () => setBulkReadyConfirm(true) },
              { id: "export", label: "Export", icon: <Download size={14} />, onClick: () => exportCsv(selectedJobs) },
            ]}
          />
        </>
      )}

      {/* Quick-view drawer — the operations decision surface for a single job */}
      <EntityDrawer
        open={drawerJobId != null}
        onOpenChange={(open) => { if (!open) setDrawerJobId(null); }}
        title={drawerJob ? `Job #${drawerJob.jobId}` : "Job"}
        description={drawerJob ? `${drawerJob.customerName} · ${drawerJob.staffName}` : undefined}
        status={drawerJob?.opsStatus}
        tabs={drawerJob ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={drawerJob.opsStatus} label={opsStatusLabel(drawerJob.opsStatus)} tone={opsStatusTone(drawerJob.opsStatus)} />
                  <StatusBadge status={drawerJob.priority} label={priorityLabel(drawerJob.priority)} tone={drawerJob.priority === "urgent" || drawerJob.priority === "high" ? "destructive" : "info"} />
                  <HealthChips job={drawerJob} />
                </div>
                {drawerJob.isEscalated && drawerJob.escalationReason && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <p className="flex items-center gap-1.5 font-medium text-destructive"><AlertTriangle size={14} /> Escalated</p>
                    <p className="text-muted-foreground mt-1">{drawerJob.escalationReason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(drawerJob.escalatedAt)}</p>
                  </div>
                )}
                {drawerJob.opsStatus === "reopened" && drawerJob.reopenReason && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="flex items-center gap-1.5 font-medium text-amber-700"><RotateCcw size={14} /> Reopened</p>
                    <p className="text-muted-foreground mt-1">{drawerJob.reopenReason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(drawerJob.reopenedAt)}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground">Service</p><p className="font-medium capitalize">{drawerJob.taskType?.replace(/_/g, " ")}</p></div>
                  <div><p className="text-muted-foreground">Asset</p><p className="font-medium">{drawerJob.assetLabel ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Scheduled</p><p className="font-medium">{drawerJob.scheduledDate}{drawerJob.scheduledTime ? ` · ${drawerJob.scheduledTime}` : ""}</p></div>
                  <div><p className="text-muted-foreground">Completed</p><p className="font-medium">{formatDate(drawerJob.completedAt)}</p></div>
                  <div><p className="text-muted-foreground">Location</p><p className="font-medium">{drawerJob.locationLabel ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Field Status</p><p className="font-medium capitalize">{drawerJob.fieldStatus?.replace(/_/g, " ")}</p></div>
                </div>
              </div>
            ),
          },
          {
            id: "progress",
            label: "Progress & Dependencies",
            content: (
              <div className="space-y-5 text-sm">
                <div>
                  <p className="font-medium mb-2">Job progress</p>
                  <ol className="space-y-2">
                    {[
                      { label: "Field Execution", done: drawerJob.fieldStatus === "completed" },
                      { label: "Quality Review", done: drawerJob.opsStatus === "approved" || drawerJob.opsStatus === "ready_for_billing", active: drawerJob.opsStatus === "pending_quality_review" },
                      { label: "Approval", done: !!drawerJob.approvedAt },
                      { label: "Ready for Billing", done: !!drawerJob.readyForBillingAt },
                    ].map((step, i) => (
                      <li key={step.label} className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step.done ? "bg-green-500/15 text-green-600" : step.active ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                          {step.done ? <CheckCircle2 size={13} /> : i + 1}
                        </span>
                        <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                        {step.active && <StatusBadge status="pending" label="In progress" tone="warning" className="ml-auto" />}
                      </li>
                    ))}
                  </ol>
                </div>
                {drawerJob.dependsOnExecutionId != null && (
                  <div>
                    <p className="font-medium mb-2 flex items-center gap-1.5"><GitBranch size={14} /> Dependency</p>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-foreground">Depends on Job #{dependencyJob?.jobId ?? drawerJob.dependsOnExecutionId}</p>
                      {dependencyJob ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <StatusBadge status={dependencyJob.opsStatus} label={opsStatusLabel(dependencyJob.opsStatus)} tone={opsStatusTone(dependencyJob.opsStatus)} />
                          {isBlocked(drawerJob) ? (
                            <span className="text-xs text-destructive">Blocking — waiting on dependency</span>
                          ) : (
                            <span className="text-xs text-green-600">Dependency resolved</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Dependency job not found in current view.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "approvals",
            label: "Approvals",
            content: (
              <div className="space-y-4 text-sm">
                <div className="rounded-md border border-border p-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Current approval</p>
                  {drawerJob.approvedAt ? (
                    <>
                      <p className="font-medium mt-1 flex items-center gap-1.5 text-green-600"><CheckCircle2 size={14} /> Approved</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(drawerJob.approvedAt)}</p>
                      {latestApproval?.description && <p className="mt-1.5">{latestApproval.description}</p>}
                      {latestApproval?.actorName && <p className="text-xs text-muted-foreground mt-1">by {latestApproval.actorName}</p>}
                    </>
                  ) : drawerJob.opsStatus === "pending_quality_review" ? (
                    <p className="font-medium mt-1 text-amber-600">Waiting for approval</p>
                  ) : (
                    <p className="text-muted-foreground mt-1">No approval recorded</p>
                  )}
                </div>
                {previousApprovals.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Previous approvals</p>
                    <div className="space-y-2">
                      {previousApprovals.map(a => (
                        <div key={a.id} className="rounded-md border border-border p-2.5">
                          <p className="font-medium">{formatDate(a.createdAt)}</p>
                          {a.description && <p className="text-muted-foreground mt-0.5">{a.description}</p>}
                          {a.actorName && <p className="text-xs text-muted-foreground mt-0.5">by {a.actorName}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            content: timelineLoading
              ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
              : <Timeline events={businessTimeline} emptyMessage="No business timeline events yet." />,
          },
          {
            id: "activity",
            label: "Activity",
            content: timelineLoading
              ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
              : <ActivityFeed items={activityTimeline} emptyMessage="No operational activity yet." />,
          },
          {
            id: "actions",
            label: "Actions",
            content: (
              <Can resource="bookings" action="edit" fallback={<p className="text-sm text-muted-foreground">You don't have permission to manage this job.</p>}>
                <div className="space-y-4">
                  <ActionBar actions={drawerActions} />
                  {drawerActions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No actions available — job is cancelled or ready for billing.</p>
                  )}
                  {canChangePriority(drawerJob) && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <Label>Change priority</Label>
                      <div className="flex gap-2">
                        <Select value={priorityDraft} onValueChange={v => setPriorityDraft(v as JobPriority)}>
                          <SelectTrigger className="w-36"><SelectValue placeholder={priorityLabel(drawerJob.priority)} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm" variant="outline"
                          disabled={priorityMutation.isPending || priorityDraft === drawerJob.priority}
                          onClick={() => priorityMutation.mutate({ id: drawerJob.id, priority: priorityDraft })}
                        >
                          Update
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Can>
            ),
          },
        ] : undefined}
      />

      {/* Escalate — reason is required by backend validation */}
      <ConfirmDialog
        open={escalateOpen}
        onOpenChange={(open) => { setEscalateOpen(open); if (!open) setEscalateReason(""); }}
        title={`Escalate job #${drawerJob?.jobId}?`}
        description={
          <div className="space-y-2">
            <p>Escalation flags this job for supervisor attention. A reason is required.</p>
            <Textarea
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="Why is this job being escalated?"
              rows={3}
              autoFocus
            />
          </div>
        }
        confirmLabel="Escalate"
        onConfirm={() => { if (drawerJob && escalateReason.trim()) escalateMutation.mutate({ id: drawerJob.id, reason: escalateReason.trim() }); }}
        isConfirming={escalateMutation.isPending}
      />

      {/* Cancel — destructive, optional reason */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(open) => { setCancelOpen(open); if (!open) setCancelReason(""); }}
        title={`Cancel job #${drawerJob?.jobId}?`}
        description={
          <div className="space-y-2">
            <p>This removes the job from active orchestration. This action cannot be undone from here.</p>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
            />
          </div>
        }
        confirmLabel="Yes, cancel job"
        cancelLabel="Keep job"
        destructive
        onConfirm={() => { if (drawerJob) cancelMutation.mutate({ id: drawerJob.id, reason: cancelReason.trim() || undefined }); }}
        isConfirming={cancelMutation.isPending}
      />

      {/* Bulk approve confirmation */}
      <ConfirmDialog
        open={bulkApproveConfirm}
        onOpenChange={setBulkApproveConfirm}
        title={`Approve ${selectedJobs.filter(canApprove).length} of ${selectedJobs.length} selected job(s)?`}
        description="Only jobs currently waiting for quality review approval will be updated. Others will be skipped."
        confirmLabel="Approve eligible jobs"
        onConfirm={async () => { await runBulk((id) => approveMutation.mutateAsync(id), canApprove, "approved"); setBulkApproveConfirm(false); }}
        isConfirming={approveMutation.isPending}
      />

      {/* Bulk ready-for-billing confirmation */}
      <ConfirmDialog
        open={bulkReadyConfirm}
        onOpenChange={setBulkReadyConfirm}
        title={`Mark ${selectedJobs.filter(canMarkReady).length} of ${selectedJobs.length} selected job(s) ready for billing?`}
        description="Only approved jobs will move to the billing handoff. Others will be skipped."
        confirmLabel="Mark ready for billing"
        onConfirm={async () => { await runBulk((id) => readyMutation.mutateAsync(id), canMarkReady, "marked ready for billing"); setBulkReadyConfirm(false); }}
        isConfirming={readyMutation.isPending}
      />
    </PageTemplate>
  );
}
