import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  UserPlus,
  Calendar,
  Phone,
  Car,
  Building2,
  FileText,
  PlusCircle,
  Check,
} from "lucide-react";
import { operationsApi, type ServiceExceptionItem } from "@/lib/operations/api";
import { useAppStore } from "@/lib/store";
import { Link } from "wouter";

const categoryLabels: Record<string, string> = {
  unassigned_booking: "Unassigned Booking",
  service_delayed: "Service Delayed",
  customer_cancellation: "Customer Cancellation",
  staff_reported_issue: "Staff Reported Issue",
  failed_photo_upload: "Missing Photo Proof",
  incomplete_service: "Incomplete Service",
  failed_notification: "Failed Notification",
  payment_failure: "Payment Failure",
  customer_complaint: "Customer Complaint",
  repeated_issue: "Repeated Issue",
  other: "Other",
};

const severityBadges: Record<string, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-red-600 text-white animate-pulse" },
  high: { label: "High", className: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  medium: { label: "Medium", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  low: { label: "Low", className: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
};

const statusBadges: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-red-500/10 text-red-600 border-red-500/20" },
  investigating: { label: "Investigating", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  acknowledged: { label: "Acknowledged", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  resolved: { label: "Resolved", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  dismissed: { label: "Dismissed", className: "bg-muted text-muted-foreground" },
};

export default function ExceptionsHub() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { activeCityId, activeBranchId } = useAppStore();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");

  // Dialog states
  const [selectedException, setSelectedException] = useState<ServiceExceptionItem | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<string>("manual_override");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    reason: "",
    category: "staff_reported_issue",
    severity: "medium",
    bookingId: "",
    customerId: "",
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["service-exceptions-list", categoryFilter, severityFilter, statusFilter, search, activeCityId, activeBranchId],
    queryFn: () =>
      operationsApi.listExceptions({
        category: categoryFilter,
        severity: severityFilter,
        status: statusFilter,
        search: search.trim() || undefined,
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
        limit: 50,
      }),
    refetchInterval: 30_000,
  });

  const scanMutation = useMutation({
    mutationFn: () => operationsApi.scanExceptions({ cityId: activeCityId ?? undefined, branchId: activeBranchId ?? undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["service-exceptions-list"] });
      qc.invalidateQueries({ queryKey: ["operations-command-center"] });
      toast({
        title: "Exception scan completed",
        description: `Processed ${res.processedCount} potential operational exceptions.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const ackMutation = useMutation({
    mutationFn: (id: number) => operationsApi.acknowledgeException(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-exceptions-list"] });
      toast({ title: "Exception acknowledged" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to acknowledge", description: err.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      operationsApi.resolveException(selectedException!.id, {
        action: resolveAction,
        resolutionNotes,
        assignedStaffId: assignedStaffId ? Number(assignedStaffId) : undefined,
        rescheduleDate: rescheduleDate || undefined,
        rescheduleTime: rescheduleTime || undefined,
      }),
    onSuccess: () => {
      setResolveDialogOpen(false);
      setSelectedException(null);
      setResolutionNotes("");
      qc.invalidateQueries({ queryKey: ["service-exceptions-list"] });
      qc.invalidateQueries({ queryKey: ["operations-command-center"] });
      toast({
        title: "Exception resolved successfully",
        description: "Authoritative state change and audit log recorded.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Resolution failed", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      operationsApi.createException({
        title: createForm.title,
        reason: createForm.reason,
        category: createForm.category,
        severity: createForm.severity,
        bookingId: createForm.bookingId ? Number(createForm.bookingId) : undefined,
        customerId: createForm.customerId ? Number(createForm.customerId) : undefined,
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
      }),
    onSuccess: () => {
      setCreateDialogOpen(false);
      setCreateForm({
        title: "",
        reason: "",
        category: "staff_reported_issue",
        severity: "medium",
        bookingId: "",
        customerId: "",
      });
      qc.invalidateQueries({ queryKey: ["service-exceptions-list"] });
      toast({ title: "Operational exception recorded" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create exception", description: err.message, variant: "destructive" });
    },
  });

  const exceptions = data?.data ?? [];
  const openCount = exceptions.filter((e) => e.status === "open").length;
  const criticalCount = exceptions.filter((e) => e.severity === "critical" && e.status !== "resolved").length;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5" data-testid="exceptions-hub">
        <PageActionHeader
          title="Service Exception Management"
          description={`${data?.total ?? 0} total exceptions · ${openCount} open · ${criticalCount} critical requiring immediate triage`}
          primaryAction={{
            label: "Scan Exceptions Now",
            onClick: () => scanMutation.mutate(),
            icon: RefreshCw,
            loading: scanMutation.isPending,
            testId: "exceptions-scan-cta",
          }}
        />

        {/* Action bar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exceptions by title, reason, code..."
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="unassigned_booking">Unassigned Booking</SelectItem>
                <SelectItem value="service_delayed">Service Delayed</SelectItem>
                <SelectItem value="customer_cancellation">Cancellation</SelectItem>
                <SelectItem value="staff_reported_issue">Staff Issue</SelectItem>
                <SelectItem value="failed_photo_upload">Photo Proof</SelectItem>
                <SelectItem value="payment_failure">Payment Failure</SelectItem>
                <SelectItem value="failed_notification">Failed Notification</SelectItem>
                <SelectItem value="customer_complaint">Customer Complaint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setCreateDialogOpen(true)}
            >
              <PlusCircle size={14} className="text-primary" />
              Report Exception
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => refetch()}
              title="Refresh"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* Exception List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : exceptions.length === 0 ? (
          <Card className="text-center py-12 border-dashed">
            <CardContent className="space-y-3">
              <CheckCircle2 size={36} className="mx-auto text-green-500" />
              <p className="font-semibold text-base">No exceptions found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No open operational exceptions match your current filters. All services are running smoothly.
              </p>
              <Button size="sm" variant="outline" onClick={() => scanMutation.mutate()}>
                Run System Scan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {exceptions.map((item) => {
              const sev = severityBadges[item.severity] || severityBadges.medium;
              const sta = statusBadges[item.status] || statusBadges.open;

              return (
                <Card
                  key={item.id}
                  className={`border transition-all shadow-sm ${
                    item.severity === "critical" && item.status !== "resolved"
                      ? "border-red-500/50 bg-red-500/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase ${sev.className}`}>
                          {sev.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] font-medium capitalize ${sta.className}`}>
                          {sta.label}
                        </Badge>
                        <span className="text-xs font-mono font-semibold text-muted-foreground">
                          {item.exceptionCode}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-medium text-foreground">
                          {categoryLabels[item.category] || item.category}
                        </span>
                      </div>

                      <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.reason}</p>

                      {/* Related Entities Tags */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                        {item.bookingId && (
                          <Link
                            href={`/admin/bookings?bookingId=${item.bookingId}`}
                            className="flex items-center gap-1 bg-secondary/80 hover:bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[11px] font-medium"
                          >
                            <Calendar size={11} className="text-primary" />
                            Booking #{item.bookingId}
                          </Link>
                        )}
                        {item.customerId && (
                          <Link
                            href={`/admin/customers/${item.customerId}`}
                            className="flex items-center gap-1 bg-secondary/80 hover:bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-[11px] font-medium"
                          >
                            <Phone size={11} className="text-primary" />
                            {item.customerName || `Customer #${item.customerId}`}
                          </Link>
                        )}
                        {item.staffName && (
                          <span className="flex items-center gap-1 bg-secondary/80 text-secondary-foreground px-2 py-0.5 rounded text-[11px]">
                            <UserCheck size={11} className="text-primary" />
                            {item.staffName}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0">
                      {item.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1"
                          onClick={() => ackMutation.mutate(item.id)}
                          disabled={ackMutation.isPending}
                        >
                          <Check size={12} />
                          Acknowledge
                        </Button>
                      )}

                      {item.status !== "resolved" && item.status !== "dismissed" && (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => {
                            setSelectedException(item);
                            setResolveDialogOpen(true);
                          }}
                        >
                          Resolve Action
                          <ArrowRight size={12} />
                        </Button>
                      )}

                      {item.status === "resolved" && (
                        <div className="text-right">
                          <span className="text-[11px] font-medium text-green-600 flex items-center gap-1 justify-end">
                            <CheckCircle2 size={12} />
                            Resolved ({item.resolutionAction || "complete"})
                          </span>
                          {item.resolutionNotes && (
                            <p className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                              {item.resolutionNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Resolve Exception</DialogTitle>
              <DialogDescription>
                Resolving requires an authoritative operational state change and records an audit log.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 bg-secondary/50 rounded-lg text-xs space-y-1">
                <p className="font-semibold">{selectedException?.title}</p>
                <p className="text-muted-foreground">{selectedException?.reason}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Resolution Action</Label>
                <Select value={resolveAction} onValueChange={setResolveAction}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual_override">Manual Override / Operational Clearance</SelectItem>
                    <SelectItem value="ticket_created">Escalate to Customer Support Ticket</SelectItem>
                    <SelectItem value="reassigned">Reassign Technician</SelectItem>
                    <SelectItem value="rescheduled">Reschedule Service Booking</SelectItem>
                    <SelectItem value="dismissed_valid">Dismiss (False Alarm / Customer Cancelled)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {resolveAction === "reassigned" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Staff ID to Assign</Label>
                  <Input
                    placeholder="Enter Staff ID..."
                    value={assignedStaffId}
                    onChange={(e) => setAssignedStaffId(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              {resolveAction === "rescheduled" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">New Date</Label>
                    <Input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">New Time</Label>
                    <Input
                      placeholder="e.g. 10:00"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Resolution Explanation / Notes *</Label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail the operational steps taken to resolve this exception..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setResolveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending || !resolutionNotes.trim()}
              >
                {resolveMutation.isPending ? "Recording..." : "Confirm Resolution"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Report Exception Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Report Operational Exception</DialogTitle>
              <DialogDescription>
                Record an operational issue requiring triage by admin or field supervisors.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Title *</Label>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Customer inaccessible in basement bay B2"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(val) => setCreateForm({ ...createForm, category: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff_reported_issue">Staff Issue</SelectItem>
                      <SelectItem value="service_delayed">Service Delayed</SelectItem>
                      <SelectItem value="failed_photo_upload">Photo Proof</SelectItem>
                      <SelectItem value="incomplete_service">Incomplete Service</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Severity</Label>
                  <Select
                    value={createForm.severity}
                    onValueChange={(val) => setCreateForm({ ...createForm, severity: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Booking ID (optional)</Label>
                  <Input
                    value={createForm.bookingId}
                    onChange={(e) => setCreateForm({ ...createForm, bookingId: e.target.value })}
                    placeholder="e.g. 120"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer ID (optional)</Label>
                  <Input
                    value={createForm.customerId}
                    onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                    placeholder="e.g. 45"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Detailed Reason / Ground Reality *</Label>
                <Textarea
                  value={createForm.reason}
                  onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                  placeholder="Explain what occurred and why intervention is required..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !createForm.title.trim() || !createForm.reason.trim()}
              >
                {createMutation.isPending ? "Submitting..." : "Report Exception"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
