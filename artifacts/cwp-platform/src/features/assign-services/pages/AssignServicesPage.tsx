import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  StickyNote,
  Trash2,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
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
  ConfirmDialog,
  OfflineState,
  type Column,
  type KpiItem,
  type TimelineEvent,
  type ActivityItem,
} from "@/components/shared";
import { CustomerProfileLink } from "@/features/customers/components/CustomerProfileLink";
import {
  ASSIGNMENTS_QUERY_KEY,
  assignPendingServiceTasks,
  fetchAssignedServices,
  fetchAssignmentDetail,
  fetchPendingAssignments,
  fetchStaffForAssignment,
  formatServiceType,
  reassignAssignment,
  recordSubstituteExecution,
  removeAssignment,
  SERVICE_TYPE_OPTIONS,
  type AssignmentFilters,
  type AssignmentTimelineEntry,
  type AssignedService,
  type PendingAssignment,
  type ServiceTaskType,
} from "@/features/assign-services/api";
import { formatAssignmentLocation } from "@/features/assign-services/formatLocation";
import { listServiceLocations } from "@/features/service-locations/api";
import { roleSlugForTaskType, taskTypeLabel } from "@/lib/staff-ecosystem/taskTypes";
import { roleLabelForSlug } from "@/lib/staff-ecosystem/roles";
import { format, parseISO, isValid } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

type QueueStatus = "waiting_assignment" | "assigned" | "ready_for_execution";

type DispatchRow = {
  key: string;
  kind: "pending" | "assigned";
  id: number;
  pendingId?: number;
  bookingId: number | null;
  customerId: number;
  customerName: string;
  assetLabel: string | null;
  serviceName: string;
  serviceType: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  priority: "normal" | "high" | null;
  staffId: number | null;
  staffName: string | null;
  assignmentStatus: QueueStatus;
  city: string | null;
  locationLabel: string | null;
  locationType: string | null;
  serviceLocationId: number | null;
  assignedAt: string | null;
  createdAt: string | null;
  taskType: ServiceTaskType | null;
  taskTypeLabel: string | null;
  notes: string | null;
  missingLocation: boolean;
  isOverdue: boolean;
  isScheduledToday: boolean;
  requiredTasks?: PendingAssignment["requiredTasks"];
  source: PendingAssignment | AssignedService;
};

type StatusFilter =
  | "all"
  | "waiting_assignment"
  | "assigned_today"
  | "assigned"
  | "ready_for_execution"
  | "overdue"
  | "high_priority";

const PAGE_SIZE = 15;
const TODAY = () => new Date().toISOString().slice(0, 10);

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "waiting_assignment", label: "Waiting assignment" },
  { value: "assigned_today", label: "Assigned today" },
  { value: "assigned", label: "Pending acceptance" },
  { value: "ready_for_execution", label: "Ready for execution" },
  { value: "overdue", label: "Overdue" },
  { value: "high_priority", label: "High priority" },
] as const;

const BUSINESS_TIMELINE_EVENTS = new Set([
  "ASSIGNMENT_CREATED",
  "READY_FOR_EXECUTION",
]);

const ACTIVITY_EVENTS = new Set([
  "ASSIGNMENT_CHANGED",
  "ASSIGNMENT_REMOVED",
  "NOTE_ADDED",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (!isValid(d)) return iso;
  return format(d, "MMM d, h:mm a");
}

function isDateToday(isoDate: string | null | undefined): boolean {
  if (!isoDate) return false;
  return isoDate.slice(0, 10) === TODAY();
}

function isScheduleOverdue(scheduledDate: string | null | undefined, waiting: boolean): boolean {
  if (!waiting || !scheduledDate) return false;
  return scheduledDate.slice(0, 10) < TODAY();
}

function toPendingRow(p: PendingAssignment): DispatchRow {
  const waiting = true;
  return {
    key: `pending:${p.id}`,
    kind: "pending",
    id: p.id,
    pendingId: p.id,
    bookingId: p.bookingId,
    customerId: p.customerId,
    customerName: p.customerName,
    assetLabel: p.assetLabel,
    serviceName: p.serviceName,
    serviceType: p.serviceType,
    scheduledDate: p.scheduledDate,
    scheduledTime: p.scheduledTime,
    priority: p.priority,
    staffId: null,
    staffName: null,
    assignmentStatus: "waiting_assignment",
    city: p.serviceLocationCity,
    locationLabel: p.serviceLocationLabel,
    locationType: p.serviceLocationType,
    serviceLocationId: p.serviceLocationId,
    assignedAt: null,
    createdAt: p.createdAt,
    taskType: null,
    taskTypeLabel: null,
    notes: p.notes,
    missingLocation: !p.serviceLocationId,
    isOverdue: isScheduleOverdue(p.scheduledDate, waiting),
    isScheduledToday: isDateToday(p.scheduledDate),
    requiredTasks: p.requiredTasks,
    source: p,
  };
}

function toAssignedRow(a: AssignedService): DispatchRow {
  return {
    key: `assigned:${a.id}`,
    kind: "assigned",
    id: a.id,
    pendingId: a.pendingAssignmentId,
    bookingId: a.bookingId,
    customerId: a.customerId,
    customerName: a.customerName,
    assetLabel: a.assetLabel,
    serviceName: a.serviceName,
    serviceType: a.serviceType,
    scheduledDate: null,
    scheduledTime: null,
    priority: null,
    staffId: a.assignedStaffId,
    staffName: a.staffName,
    assignmentStatus: a.status,
    city: a.serviceLocationCity,
    locationLabel: a.serviceLocationLabel,
    locationType: a.serviceLocationType,
    serviceLocationId: a.serviceLocationId,
    assignedAt: a.assignedAt,
    createdAt: a.assignedAt,
    taskType: a.taskType,
    taskTypeLabel: a.taskTypeLabel,
    notes: a.notes,
    missingLocation: !a.serviceLocationId,
    isOverdue: false,
    isScheduledToday: isDateToday(a.assignedAt),
    source: a,
  };
}

function timelineTone(eventType: string): TimelineEvent["tone"] {
  if (eventType === "ASSIGNMENT_REMOVED") return "destructive";
  if (eventType === "READY_FOR_EXECUTION") return "success";
  if (eventType === "ASSIGNMENT_CHANGED") return "warning";
  return "default";
}

function timelineIcon(eventType: string): TimelineEvent["icon"] {
  if (eventType === "ASSIGNMENT_CHANGED") return RefreshCw;
  if (eventType === "ASSIGNMENT_REMOVED") return Trash2;
  if (eventType === "READY_FOR_EXECUTION") return CheckCircle;
  if (eventType === "NOTE_ADDED") return StickyNote;
  return UserCheck;
}

function TaskStaffPicker({
  taskType,
  value,
  onChange,
  disabled,
  assignedName,
}: {
  taskType: ServiceTaskType;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  assignedName?: string;
}) {
  const roleSlug = roleSlugForTaskType(taskType);
  const { data: staffList = [], isLoading } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "staff", taskType, roleSlug],
    queryFn: () => fetchStaffForAssignment(roleSlug),
    enabled: !assignedName,
  });

  if (assignedName) {
    return (
      <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
        <span className="text-muted-foreground">{taskTypeLabel(taskType)}:</span>{" "}
        <span className="font-medium">{assignedName}</span>
        <StatusBadge status="assigned" className="ml-2" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label>{taskTypeLabel(taskType)}</Label>
      <p className="text-xs text-muted-foreground">Role: {roleLabelForSlug(roleSlug)}</p>
      <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading…" : staffList.length === 0 ? "No matching staff" : "Select staff"} />
        </SelectTrigger>
        <SelectContent>
          {staffList.map(s => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
              {s.employeeCode ? ` · ${s.employeeCode}` : ""}
              {s.operationalRoles?.length
                ? ` (${s.operationalRoles.map(r => r.roleName).join(", ")})`
                : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isLoading && staffList.length === 0 && (
        <p className="text-xs text-amber-700">
          No staff with {roleLabelForSlug(roleSlug)} role. Add it on the staff profile.
        </p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AssignServicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("waiting_assignment");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "normal">("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("");
  const [dateValue, setDateValue] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "datetime",
    direction: "asc",
  });
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);

  const [taskStaff, setTaskStaff] = useState<Partial<Record<ServiceTaskType, string>>>({});
  const [assignNotes, setAssignNotes] = useState("");

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTargets, setReassignTargets] = useState<DispatchRow[]>([]);
  const [reassignStaffId, setReassignStaffId] = useState("");
  const [reassignNotes, setReassignNotes] = useState("");

  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [substituteRow, setSubstituteRow] = useState<DispatchRow | null>(null);
  const [substituteStaffId, setSubstituteStaffId] = useState("");
  const [substituteReason, setSubstituteReason] = useState("");

  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [bulkRemoveConfirm, setBulkRemoveConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<DispatchRow | null>(null);

  const serverFilters: AssignmentFilters = useMemo(() => {
    const f: AssignmentFilters = {};
    if (serviceTypeFilter) f.serviceType = serviceTypeFilter;
    if (technicianFilter !== "all") f.staffId = parseInt(technicianFilter, 10);
    if (dateValue) {
      f.dateFrom = dateValue;
      f.dateTo = dateValue;
    }
    return f;
  }, [serviceTypeFilter, technicianFilter, dateValue]);

  const {
    data: pending = [],
    isLoading: pendingLoading,
    isError: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "pending", serverFilters],
    queryFn: () => fetchPendingAssignments(serverFilters),
  });

  const {
    data: assigned = [],
    isLoading: assignedLoading,
    isError: assignedError,
    refetch: refetchAssigned,
  } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "assigned", serverFilters],
    queryFn: () => fetchAssignedServices(serverFilters),
  });

  const allRows = useMemo(() => {
    return [...pending.map(toPendingRow), ...assigned.map(toAssignedRow)];
  }, [pending, assigned]);

  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    for (const r of allRows) {
      if (r.city?.trim()) cities.add(r.city.trim());
    }
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const { data: filterStaffList = [] } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "staff", "filter"],
    queryFn: () => fetchStaffForAssignment(),
  });

  const { data: locationsResponse } = useQuery({
    queryKey: ["service-locations", "assign-filter"],
    queryFn: () => listServiceLocations({ limit: 100 }),
  });
  const locations = locationsResponse?.data ?? [];

  const kpiCounts = useMemo(() => {
    const waiting = pending.length;
    const assignedToday = assigned.filter(a => isDateToday(a.assignedAt)).length;
    const pendingAcceptance = assigned.filter(a => a.status === "assigned").length;
    const ready = assigned.filter(a => a.status === "ready_for_execution").length;
    const overdue = pending.filter(p => isScheduleOverdue(p.scheduledDate, true)).length;
    const highPriority = pending.filter(p => p.priority === "high").length;
    return { waiting, assignedToday, pendingAcceptance, ready, overdue, highPriority };
  }, [pending, assigned]);

  const filteredRows = useMemo(() => {
    let list = allRows;

    switch (statusFilter) {
      case "waiting_assignment":
        list = list.filter(r => r.kind === "pending");
        break;
      case "assigned_today":
        list = list.filter(r => r.kind === "assigned" && isDateToday(r.assignedAt));
        break;
      case "assigned":
        list = list.filter(r => r.assignmentStatus === "assigned");
        break;
      case "ready_for_execution":
        list = list.filter(r => r.assignmentStatus === "ready_for_execution");
        break;
      case "overdue":
        list = list.filter(r => r.isOverdue);
        break;
      case "high_priority":
        list = list.filter(r => r.priority === "high");
        break;
      default:
        break;
    }

    if (priorityFilter !== "all") {
      list = list.filter(r => r.kind === "pending" && r.priority === priorityFilter);
    }

    if (cityFilter !== "all") {
      list = list.filter(r => (r.city ?? "").trim() === cityFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.customerName.toLowerCase().includes(q)
        || r.serviceName.toLowerCase().includes(q)
        || (r.staffName ?? "").toLowerCase().includes(q)
        || (r.city ?? "").toLowerCase().includes(q)
        || (r.locationLabel ?? "").toLowerCase().includes(q)
        || (r.assetLabel ?? "").toLowerCase().includes(q)
        || String(r.id).includes(q)
        || String(r.bookingId ?? "").includes(q),
      );
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "id") cmp = a.id - b.id;
      else if (sort.key === "customer") cmp = a.customerName.localeCompare(b.customerName);
      else if (sort.key === "datetime") {
        const aDate = a.scheduledDate ?? a.assignedAt ?? "";
        const bDate = b.scheduledDate ?? b.assignedAt ?? "";
        cmp = aDate.localeCompare(bDate);
      } else if (sort.key === "priority") {
        cmp = (a.priority === "high" ? 1 : 0) - (b.priority === "high" ? 1 : 0);
      } else if (sort.key === "status") {
        cmp = a.assignmentStatus.localeCompare(b.assignmentStatus);
      } else if (sort.key === "technician") {
        cmp = (a.staffName ?? "").localeCompare(b.staffName ?? "");
      }
      return sort.direction === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [allRows, statusFilter, priorityFilter, cityFilter, search, sort]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const drawerRow = useMemo(
    () => allRows.find(r => r.key === drawerKey) ?? null,
    [allRows, drawerKey],
  );

  const drawerPending = drawerRow?.kind === "pending"
    ? (drawerRow.source as PendingAssignment)
    : null;

  const detailId = drawerRow?.kind === "assigned" ? drawerRow.id : null;
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "detail", detailId],
    queryFn: () => fetchAssignmentDetail(detailId!),
    enabled: detailId != null,
  });

  const unassignedTasks = useMemo(() => {
    if (!drawerPending) return [];
    return drawerPending.requiredTasks.filter(t => !t.staffId);
  }, [drawerPending]);

  const canAssign = useMemo(() => {
    if (!drawerPending?.serviceLocationId || unassignedTasks.length === 0) return false;
    return unassignedTasks.every(t => Boolean(taskStaff[t.taskType]?.trim()));
  }, [drawerPending, unassignedTasks, taskStaff]);

  const openDrawer = (row: DispatchRow) => {
    setDrawerKey(row.key);
    setTaskStaff({});
    setAssignNotes("");
  };

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!drawerPending) throw new Error("Select a waiting job");
      const tasks = unassignedTasks.map(t => ({
        taskType: t.taskType,
        staffId: parseInt(taskStaff[t.taskType]!, 10),
      }));
      return assignPendingServiceTasks(drawerPending.id, tasks, assignNotes.trim() || undefined);
    },
    onSuccess: () => {
      toast({ title: "Staff assigned — ready for execution" });
      setDrawerKey(null);
      setTaskStaff({});
      setAssignNotes("");
      setStatusFilter("ready_for_execution");
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
    },
    onError: (e: Error) => {
      toast({ title: "Assignment failed", description: e.message, variant: "destructive" });
    },
  });

  const reassignRoleSlug = reassignTargets[0]?.taskType
    ? roleSlugForTaskType(reassignTargets[0].taskType)
    : null;
  const { data: reassignStaffList = [] } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "reassign-staff", reassignRoleSlug],
    queryFn: () => fetchStaffForAssignment(reassignRoleSlug!),
    enabled: reassignOpen && Boolean(reassignRoleSlug),
  });

  const substituteRoleSlug = substituteRow?.taskType
    ? roleSlugForTaskType(substituteRow.taskType)
    : null;
  const { data: substituteStaffList = [] } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "substitute-staff", substituteRoleSlug],
    queryFn: () => fetchStaffForAssignment(substituteRoleSlug!),
    enabled: substituteOpen && Boolean(substituteRoleSlug),
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const staffId = parseInt(reassignStaffId, 10);
      await Promise.all(
        reassignTargets.map(row =>
          reassignAssignment(row.id, staffId, reassignNotes.trim() || undefined),
        ),
      );
    },
    onSuccess: () => {
      toast({ title: reassignTargets.length > 1 ? "Assignments reassigned" : "Assignment changed" });
      setReassignOpen(false);
      setReassignTargets([]);
      setReassignStaffId("");
      setReassignNotes("");
      setSelectedKeys([]);
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
    },
    onError: (e: Error) => {
      toast({ title: "Reassign failed", description: e.message, variant: "destructive" });
    },
  });

  const substituteMutation = useMutation({
    mutationFn: () => {
      if (!substituteRow || substituteRow.kind !== "assigned") throw new Error("No assignment selected");
      const src = substituteRow.source as AssignedService;
      return recordSubstituteExecution({
        contractId: src.contractId,
        taskType: src.taskType,
        substituteStaffId: parseInt(substituteStaffId, 10),
        reason: substituteReason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Substitute job created for today" });
      setSubstituteOpen(false);
      setSubstituteRow(null);
      setSubstituteStaffId("");
      setSubstituteReason("");
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
    },
    onError: (e: Error) => {
      toast({ title: "Substitute failed", description: e.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (rows: DispatchRow[]) => {
      await Promise.all(rows.filter(r => r.kind === "assigned").map(r => removeAssignment(r.id)));
    },
    onSuccess: (_data, rows) => {
      toast({
        title: rows.length > 1
          ? `${rows.length} assignments cancelled — back in waiting queue`
          : "Assignment cancelled — back in waiting queue",
      });
      setRemoveConfirm(false);
      setBulkRemoveConfirm(false);
      setRemoveTarget(null);
      setDrawerKey(null);
      setSelectedKeys([]);
      setStatusFilter("waiting_assignment");
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
    },
    onError: (e: Error) => {
      toast({ title: "Cancel failed", description: e.message, variant: "destructive" });
    },
  });

  const selectedRows = useMemo(
    () => allRows.filter(r => selectedKeys.includes(r.key)),
    [allRows, selectedKeys],
  );
  const selectedPending = selectedRows.filter(r => r.kind === "pending");
  const selectedAssigned = selectedRows.filter(r => r.kind === "assigned");

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTechnicianFilter("all");
    setCityFilter("all");
    setServiceTypeFilter("");
    setDateValue(undefined);
    setPage(1);
  };

  const hasActiveFilters =
    search !== ""
    || statusFilter !== "all"
    || priorityFilter !== "all"
    || technicianFilter !== "all"
    || cityFilter !== "all"
    || !!serviceTypeFilter
    || !!dateValue;

  const applyStatusFilter = (next: StatusFilter) => {
    setStatusFilter(next);
    setPage(1);
    setSelectedKeys([]);
  };

  const openReassign = (rows: DispatchRow[]) => {
    const assignedOnly = rows.filter(r => r.kind === "assigned" && r.taskType);
    if (assignedOnly.length === 0) {
      toast({ title: "Select assigned jobs to reassign", variant: "destructive" });
      return;
    }
    const taskTypes = new Set(assignedOnly.map(r => r.taskType));
    if (taskTypes.size > 1) {
      toast({
        title: "Select jobs with the same task type",
        description: "Bulk reassign requires matching task roles so the right staff list loads.",
        variant: "destructive",
      });
      return;
    }
    setReassignTargets(assignedOnly);
    setReassignStaffId("");
    setReassignNotes("");
    setReassignOpen(true);
  };

  const openBulkAssign = () => {
    if (selectedPending.length === 1) {
      openDrawer(selectedPending[0]!);
      return;
    }
    if (selectedPending.length > 1) {
      toast({
        title: "Assign one job at a time",
        description: "Open a waiting job to assign each required task to the right technician.",
      });
      openDrawer(selectedPending[0]!);
      return;
    }
    toast({ title: "Select a waiting job to assign", variant: "destructive" });
  };

  const businessTimeline: TimelineEvent[] = useMemo(() => {
    const events = (detail?.timeline ?? []).filter(e => BUSINESS_TIMELINE_EVENTS.has(e.eventType));
    // Pending jobs: synthesize a minimal business timeline from queue data
    if (drawerPending && events.length === 0) {
      return [
        {
          id: `queued-${drawerPending.id}`,
          title: "Booking / job queued",
          description: "Waiting for staff assignment",
          timestamp: formatDateTime(drawerPending.createdAt),
          icon: Calendar,
          tone: "warning" as const,
        },
      ];
    }
    return events.map((e: AssignmentTimelineEntry) => ({
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      actor: e.actorName ?? undefined,
      timestamp: formatDateTime(e.createdAt),
      icon: timelineIcon(e.eventType),
      tone: timelineTone(e.eventType),
    }));
  }, [detail, drawerPending]);

  const activityItems: ActivityItem[] = useMemo(() => {
    const events = (detail?.timeline ?? []).filter(e => ACTIVITY_EVENTS.has(e.eventType));
    return events.map((e: AssignmentTimelineEntry) => ({
      id: e.id,
      icon: timelineIcon(e.eventType),
      title: e.title,
      subtitle: [e.description, e.notes, e.actorName].filter(Boolean).join(" · ") || undefined,
      timestamp: formatDateTime(e.createdAt),
    }));
  }, [detail]);

  const columns: Column<DispatchRow>[] = [
    {
      key: "id",
      header: "ID",
      sortable: true,
      hideable: true,
      defaultHidden: true,
      cell: r => (
        <span className="text-muted-foreground font-mono text-xs">
          {r.kind === "pending" ? `Q#${r.id}` : `A#${r.id}`}
          {r.bookingId ? <span className="block">B#{r.bookingId}</span> : null}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      cell: r => (
        <div className="flex items-center gap-2 min-w-0">
          <User size={13} className="text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{r.customerName}</p>
            {r.city && <p className="text-xs text-muted-foreground truncate">{r.city}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      hideable: true,
      cell: r => <span className="text-muted-foreground text-sm">{r.assetLabel ?? "—"}</span>,
    },
    {
      key: "service",
      header: "Service",
      cell: r => (
        <div>
          <p className="text-foreground">{r.serviceName}</p>
          <p className="text-xs text-muted-foreground">{formatServiceType(r.serviceType)}</p>
          {r.taskTypeLabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{r.taskTypeLabel}</p>
          )}
        </div>
      ),
    },
    {
      key: "datetime",
      header: "Date & Time",
      sortable: true,
      cell: r => (
        <div>
          {r.scheduledDate ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-foreground">
                <Calendar size={11} className="text-muted-foreground" />
                <span>{r.scheduledDate}</span>
              </div>
              {r.scheduledTime && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Clock size={11} />
                  <span>{r.scheduledTime}</span>
                </div>
              )}
            </>
          ) : r.assignedAt ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={11} />
              <span>{formatDateTime(r.assignedAt)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {r.isOverdue && (
            <div className="mt-1">
              <StatusBadge status="overdue" label="Delayed" />
            </div>
          )}
          {r.isScheduledToday && r.kind === "pending" && !r.isOverdue && (
            <div className="mt-1">
              <StatusBadge status="scheduled" label="Today" tone="info" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      hideable: true,
      cell: r =>
        r.priority ? (
          <StatusBadge
            status={r.priority}
            label={r.priority === "high" ? "High" : "Normal"}
            tone={r.priority === "high" ? "destructive" : "neutral"}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "technician",
      header: "Technician",
      sortable: true,
      cell: r => (
        <span className="text-sm">
          {r.staffName ?? (
            <span className="text-amber-700">Unassigned</span>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: "Assignment Status",
      sortable: true,
      cell: r => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={r.assignmentStatus} />
          {r.missingLocation && <StatusBadge status="blocked" label="No address" />}
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
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 px-2"
          onClick={e => {
            e.stopPropagation();
            openDrawer(r);
          }}
        >
          {r.kind === "pending" ? "Assign" : "View"}
        </Button>
      ),
    },
  ];

  const kpis: KpiItem[] = [
    {
      id: "waiting",
      label: "Waiting Assignment",
      value: kpiCounts.waiting,
      icon: UserCog,
      tone: kpiCounts.waiting > 0 ? "warning" : "default",
      onClick: () => applyStatusFilter("waiting_assignment"),
    },
    {
      id: "assigned-today",
      label: "Assigned Today",
      value: kpiCounts.assignedToday,
      icon: Calendar,
      onClick: () => applyStatusFilter("assigned_today"),
    },
    {
      id: "pending-acceptance",
      label: "Pending Acceptance",
      value: kpiCounts.pendingAcceptance,
      icon: Users,
      tone: kpiCounts.pendingAcceptance > 0 ? "warning" : "default",
      onClick: () => applyStatusFilter("assigned"),
    },
    {
      id: "ready",
      label: "Ready for Execution",
      value: kpiCounts.ready,
      icon: Zap,
      tone: kpiCounts.ready > 0 ? "success" : "default",
      onClick: () => applyStatusFilter("ready_for_execution"),
    },
    {
      id: "overdue",
      label: "Overdue Assignments",
      value: kpiCounts.overdue,
      icon: AlertTriangle,
      tone: kpiCounts.overdue > 0 ? "destructive" : "default",
      onClick: () => applyStatusFilter("overdue"),
    },
    {
      id: "high-priority",
      label: "High Priority Jobs",
      value: kpiCounts.highPriority,
      icon: AlertTriangle,
      tone: kpiCounts.highPriority > 0 ? "destructive" : "default",
      onClick: () => applyStatusFilter("high_priority"),
    },
  ];

  const isLoading = pendingLoading || assignedLoading;
  const isError = pendingError || assignedError;
  const refetch = () => {
    void refetchPending();
    void refetchAssigned();
  };

  const nextWaiting = useMemo(() => {
    const high = pending.find(p => p.priority === "high");
    return high ?? pending[0] ?? null;
  }, [pending]);

  return (
    <PageTemplate
      title="Staff Assignment"
      description="Operations dispatch center — assign technicians, clear overdue work, and keep today’s queue moving."
      breadcrumbs={[{ label: "Operations" }, { label: "Staff Assignment" }]}
      primaryAction={{
        label: nextWaiting ? "Assign next waiting" : "Waiting queue clear",
        onClick: () => {
          if (!nextWaiting) return;
          applyStatusFilter("waiting_assignment");
          openDrawer(toPendingRow(nextWaiting));
        },
        testId: "assign-service-primary-cta",
      }}
      stats={<KpiRow items={kpis} columns={6} />}
      filters={
        <FilterBar
          search={search}
          onSearchChange={v => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search customer, service, technician, city, ID…"
          statusOptions={STATUS_FILTER_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          statusValue={statusFilter}
          onStatusChange={v => applyStatusFilter(v as StatusFilter)}
          statusPlaceholder="Status"
          quickFilters={[
            {
              id: "today",
              label: "Scheduled today",
              active: dateValue === TODAY(),
              onClick: () => {
                setDateValue(prev => (prev === TODAY() ? undefined : TODAY()));
                setPage(1);
              },
            },
            {
              id: "high",
              label: "High priority",
              active: statusFilter === "high_priority" || priorityFilter === "high",
              onClick: () => {
                if (statusFilter === "high_priority") {
                  applyStatusFilter("all");
                  setPriorityFilter("all");
                } else {
                  applyStatusFilter("high_priority");
                }
              },
            },
          ]}
          onClearAll={hasActiveFilters ? clearFilters : undefined}
        >
          <Select
            value={technicianFilter}
            onValueChange={v => { setTechnicianFilter(v); setPage(1); }}
          >
            <SelectTrigger className="w-[160px]" aria-label="Filter by technician">
              <SelectValue placeholder="Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All technicians</SelectItem>
              {filterStaffList.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateValue ?? ""}
            onChange={e => { setDateValue(e.target.value || undefined); setPage(1); }}
            className="w-40"
            aria-label="Filter by date"
          />

          {cityOptions.length > 0 && (
            <Select value={cityFilter} onValueChange={v => { setCityFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by city">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {cityOptions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={priorityFilter}
            onValueChange={v => { setPriorityFilter(v as "all" | "high" | "normal"); setPage(1); }}
          >
            <SelectTrigger className="w-[130px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={serviceTypeFilter || "all"}
            onValueChange={v => { setServiceTypeFilter(v === "all" ? "" : v); setPage(1); }}
          >
            <SelectTrigger className="w-[160px]" aria-label="Filter by service type">
              <SelectValue placeholder="Service type" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value || "all"} value={o.value || "all"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      }
    >
      {!isOnline ? (
        <OfflineState onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={pageRows}
            isLoading={isLoading}
            error={isError ? true : undefined}
            onRetry={refetch}
            rowKey={r => r.key}
            onRowClick={openDrawer}
            rowLabel={r =>
              r.kind === "pending"
                ? `Assign job #${r.id} for ${r.customerName}`
                : `View assignment #${r.id} for ${r.customerName}`
            }
            caption="Staff assignment dispatch queue — waiting, assigned, and ready jobs"
            emptyTitle={hasActiveFilters ? "No jobs match your filters" : "Dispatch queue is clear"}
            emptyDescription={
              hasActiveFilters
                ? "Try a different status, technician, or date — or clear filters."
                : "New bookings and contracts waiting for staff will appear here."
            }
            emptyAction={
              hasActiveFilters
                ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>
                : undefined
            }
            sort={{
              key: sort.key,
              direction: sort.direction,
              onSortChange: (key, direction) => setSort({ key, direction }),
            }}
            selection={{ selectedKeys, onSelectionChange: setSelectedKeys }}
            enableColumnVisibility
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: filteredRows.length,
              onPageChange: setPage,
            }}
          />

          <BulkActionBar
            selectedCount={selectedKeys.length}
            onClear={() => setSelectedKeys([])}
            actions={[
              {
                id: "assign",
                label: "Assign Technician",
                icon: <UserCheck size={14} />,
                onClick: openBulkAssign,
                disabled: selectedPending.length === 0,
              },
              {
                id: "reassign",
                label: "Reassign",
                icon: <RefreshCw size={14} />,
                onClick: () => openReassign(selectedAssigned),
                disabled: selectedAssigned.length === 0,
              },
              {
                id: "cancel",
                label: "Cancel Assignment",
                icon: <Trash2 size={14} />,
                variant: "destructive",
                onClick: () => setBulkRemoveConfirm(true),
                disabled: selectedAssigned.length === 0 || removeMutation.isPending,
              },
            ]}
          />
        </>
      )}

      <EntityDrawer
        open={!!drawerKey}
        onOpenChange={open => {
          if (!open) setDrawerKey(null);
        }}
        title={
          drawerRow
            ? drawerRow.kind === "pending"
              ? `Waiting #${drawerRow.id}`
              : `Assignment #${drawerRow.id}`
            : "Assignment"
        }
        description={drawerRow?.customerName}
        status={drawerRow?.assignmentStatus}
        tabs={
          drawerRow
            ? [
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={drawerRow.assignmentStatus} />
                        {drawerRow.priority === "high" && (
                          <StatusBadge status="high" label="High priority" tone="destructive" />
                        )}
                        {drawerRow.isOverdue && (
                          <StatusBadge status="overdue" label="Delayed" />
                        )}
                        {drawerRow.assignmentStatus === "ready_for_execution" && (
                          <StatusBadge status="ready_for_execution" label="Ready" />
                        )}
                        {drawerRow.missingLocation && (
                          <StatusBadge status="blocked" label="No address" />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-muted-foreground">Service</p>
                          <p className="font-medium">{drawerRow.serviceName}</p>
                          <p className="text-xs text-muted-foreground">{formatServiceType(drawerRow.serviceType)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Schedule</p>
                          <p className="font-medium">
                            {drawerRow.scheduledDate
                              ? `${drawerRow.scheduledDate}${drawerRow.scheduledTime ? ` ${drawerRow.scheduledTime}` : ""}`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Technician</p>
                          <p className="font-medium">{drawerRow.staffName ?? "Unassigned"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Task</p>
                          <p className="font-medium">{drawerRow.taskTypeLabel ?? "Multiple / pending"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground flex items-center gap-1">
                            <MapPin size={12} /> Address
                          </p>
                          <p className="font-medium">
                            {drawerRow.locationLabel
                              ? formatAssignmentLocation({
                                  serviceLocationLabel: drawerRow.locationLabel,
                                  serviceLocationType: drawerRow.locationType,
                                  serviceLocationCity: drawerRow.city,
                                })
                              : "Missing — cannot assign"}
                          </p>
                        </div>
                        {drawerRow.bookingId && (
                          <div>
                            <p className="text-muted-foreground">Booking</p>
                            <p className="font-medium">#{drawerRow.bookingId}</p>
                          </div>
                        )}
                        {locations.length > 0 && drawerRow.serviceLocationId && (
                          <div>
                            <p className="text-muted-foreground">Location ID</p>
                            <p className="font-medium">#{drawerRow.serviceLocationId}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  id: "assignment",
                  label: "Assignment",
                  content: drawerPending ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Assign each required task to a technician. Job becomes ready for execution when tasks are covered.
                      </p>
                      <div className="space-y-3">
                        {drawerPending.requiredTasks.map(slot => (
                          <TaskStaffPicker
                            key={slot.taskType}
                            taskType={slot.taskType}
                            value={taskStaff[slot.taskType] ?? ""}
                            onChange={v => setTaskStaff(prev => ({ ...prev, [slot.taskType]: v }))}
                            disabled={!drawerPending.serviceLocationId}
                            assignedName={slot.staffName}
                          />
                        ))}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="assign-notes">Assignment notes (optional)</Label>
                        <Textarea
                          id="assign-notes"
                          value={assignNotes}
                          onChange={e => setAssignNotes(e.target.value)}
                          rows={2}
                          placeholder="Internal note for this assignment"
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={!canAssign || assignMutation.isPending}
                        onClick={() => assignMutation.mutate()}
                      >
                        {assignMutation.isPending ? (
                          <><Loader2 size={14} className="mr-2 animate-spin" /> Assigning…</>
                        ) : unassignedTasks.length > 1 ? (
                          `Assign ${unassignedTasks.length} tasks`
                        ) : (
                          "Assign staff"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Technician</p>
                        <p className="font-medium">{drawerRow.staffName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Task</p>
                        <p className="font-medium">{drawerRow.taskTypeLabel}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Assigned at</p>
                        <p className="font-medium">{formatDateTime(drawerRow.assignedAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <StatusBadge status={drawerRow.assignmentStatus} />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "customer",
                  label: "Customer",
                  content: (
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Customer</p>
                        <p className="font-medium">{drawerRow.customerName}</p>
                        <CustomerProfileLink
                          customerId={drawerRow.customerId}
                          customerBasePath="/admin/customers"
                          name={drawerRow.customerName}
                          className="mt-2 h-7 text-xs"
                        />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vehicle</p>
                        <p className="font-medium">{drawerRow.assetLabel ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Service address</p>
                        <p className="font-medium">
                          {drawerRow.locationLabel
                            ? formatAssignmentLocation({
                                serviceLocationLabel: drawerRow.locationLabel,
                                serviceLocationType: drawerRow.locationType,
                                serviceLocationCity: drawerRow.city,
                              })
                            : "—"}
                        </p>
                        {detail?.serviceLocationAddress && (
                          <p className="text-xs text-muted-foreground mt-1">{detail.serviceLocationAddress}</p>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  id: "timeline",
                  label: "Timeline",
                  content:
                    drawerRow.kind === "assigned" && detailLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
                    ) : (
                      <Timeline
                        events={businessTimeline}
                        emptyMessage="No workflow events yet."
                      />
                    ),
                },
                {
                  id: "activity",
                  label: "Activity",
                  content:
                    drawerRow.kind === "assigned" && detailLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
                    ) : (
                      <ActivityFeed
                        items={activityItems}
                        emptyMessage="No dispatcher activity recorded yet."
                      />
                    ),
                },
                {
                  id: "notes",
                  label: "Notes",
                  content: (
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Assignment notes</p>
                        <p className="font-medium">
                          {(drawerRow.kind === "assigned" ? detail?.notes : null)
                            || drawerRow.notes
                            || "No notes"}
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  id: "actions",
                  label: "Actions",
                  content: (
                    <div className="space-y-3">
                      {drawerRow.kind === "pending" && (
                        <Button
                          className="w-full"
                          size="sm"
                          disabled={!canAssign || assignMutation.isPending}
                          onClick={() => assignMutation.mutate()}
                        >
                          <UserCheck size={14} className="mr-2" />
                          Assign technician
                        </Button>
                      )}
                      {drawerRow.kind === "assigned" && (
                        <>
                          <Button
                            className="w-full"
                            size="sm"
                            variant="outline"
                            onClick={() => openReassign([drawerRow])}
                          >
                            <RefreshCw size={14} className="mr-2" /> Reassign
                          </Button>
                          <Button
                            className="w-full"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSubstituteRow(drawerRow);
                              setSubstituteStaffId("");
                              setSubstituteReason("");
                              setSubstituteOpen(true);
                            }}
                          >
                            <UserPlus size={14} className="mr-2" /> Substitute for today
                          </Button>
                          <Button
                            className="w-full"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setRemoveTarget(drawerRow);
                              setRemoveConfirm(true);
                            }}
                          >
                            <Trash2 size={14} className="mr-2" /> Cancel assignment
                          </Button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]
            : []
        }
      />

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reassignTargets.length > 1
                ? `Reassign ${reassignTargets.length} jobs`
                : "Reassign staff"}
            </DialogTitle>
            <DialogDescription>
              {reassignTargets[0]
                ? `Change ${reassignTargets[0].taskTypeLabel} to another technician.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>New technician</Label>
              <Select value={reassignStaffId} onValueChange={setReassignStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {reassignStaffList
                    .filter(s => !reassignTargets.some(t => t.staffId === s.id))
                    .map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                value={reassignNotes}
                onChange={e => setReassignNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button
              disabled={!reassignStaffId || reassignMutation.isPending}
              onClick={() => reassignMutation.mutate()}
            >
              {reassignMutation.isPending ? "Saving…" : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={substituteOpen} onOpenChange={setSubstituteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substitute for today</DialogTitle>
            <DialogDescription>
              {substituteRow
                ? `Cover ${substituteRow.taskTypeLabel} for ${substituteRow.customerName} while ${substituteRow.staffName} is absent.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Substitute staff</Label>
              <Select value={substituteStaffId} onValueChange={setSubstituteStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select substitute" />
                </SelectTrigger>
                <SelectContent>
                  {substituteStaffList
                    .filter(s => s.id !== substituteRow?.staffId)
                    .map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                        {s.operationalRoles?.length
                          ? ` (${s.operationalRoles.map(r => r.roleName).join(", ")})`
                          : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. On leave"
                value={substituteReason}
                onChange={e => setSubstituteReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubstituteOpen(false)}>Cancel</Button>
            <Button
              disabled={!substituteStaffId || substituteMutation.isPending}
              onClick={() => substituteMutation.mutate()}
            >
              {substituteMutation.isPending ? "Creating…" : "Create substitute job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeConfirm}
        onOpenChange={setRemoveConfirm}
        title="Cancel this assignment?"
        description={`Assignment #${removeTarget?.id} returns to the waiting queue. The technician will no longer be assigned.`}
        confirmLabel="Yes, cancel assignment"
        cancelLabel="Keep assignment"
        destructive
        isConfirming={removeMutation.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          removeMutation.mutate([removeTarget]);
        }}
      />

      <ConfirmDialog
        open={bulkRemoveConfirm}
        onOpenChange={setBulkRemoveConfirm}
        title={`Cancel ${selectedAssigned.length} assignment(s)?`}
        description="Selected assignments return to the waiting queue. This cannot be undone from here."
        confirmLabel="Yes, cancel selected"
        cancelLabel="Keep assignments"
        destructive
        isConfirming={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(selectedAssigned)}
      />
    </PageTemplate>
  );
}
