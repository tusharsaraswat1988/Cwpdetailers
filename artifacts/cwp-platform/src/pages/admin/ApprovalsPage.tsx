import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  Shield,
  Trash2,
  RefreshCw,
  Search,
  Check,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type MakeupApprovalRequest = {
  id: number;
  bookingId: number;
  customerId: number;
  cityId: number | null;
  branchId: number | null;
  contractRegistryId: number | null;
  requestedDate: string;
  requestedTime: string;
  requestedNotes: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "expired";
  decidedBy: number | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdBookingId: number | null;
  previousMakeupsCount: number;
  applicableQuota: number;
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  cityName: string | null;
  branchName: string | null;
  originalDate: string | null;
  originalTime: string | null;
  originalServiceType: string | null;
  originalAddress: string | null;
};

type RetentionStats = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastRecordsDeleted: number;
  totalRecordsDeleted: number;
  lastDurationMs: number;
  lastError: string | null;
  retentionDaysConfigured: number;
  schedulerActive: boolean;
};

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Approval / Rejection Dialog States
  const [approveModal, setApproveModal] = useState<MakeupApprovalRequest | null>(null);
  const [approveNotes, setApproveNotes] = useState<string>("");
  const [rejectModal, setRejectModal] = useState<MakeupApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  // Fetch Approval Requests
  const { data, isLoading, refetch } = useQuery<{ requests: MakeupApprovalRequest[]; total: number }>({
    queryKey: ["makeup-approvals", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      const res = await fetch(`/api/admin/makeup-approvals?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load approval requests");
      return res.json();
    },
  });

  // Fetch GPS Retention Telemetry Stats
  const { data: retentionStats, refetch: refetchRetention } = useQuery<RetentionStats>({
    queryKey: ["gps-retention-status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tracking/retention-status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch retention stats");
      return res.json();
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await fetch(`/api/admin/makeup-approvals/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      return data;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["makeup-approvals"] });
      toast({
        title: "Makeup Request Approved",
        description: `Linked makeup booking #${res.booking?.id ?? ""} has been created and queued for technician dispatch.`,
      });
      setApproveModal(null);
      setApproveNotes("");
    },
    onError: (err: Error) => {
      toast({
        title: "Approval Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/admin/makeup-approvals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rejection failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["makeup-approvals"] });
      toast({
        title: "Makeup Request Rejected",
        description: "Customer request has been rejected with audit reason.",
      });
      setRejectModal(null);
      setRejectReason("");
    },
    onError: (err: Error) => {
      toast({
        title: "Rejection Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Trigger Retention Purge Mutation
  const purgeMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await fetch("/api/admin/tracking/run-purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purge execution failed");
      return data;
    },
    onSuccess: (data) => {
      refetchRetention();
      toast({
        title: data.dryRun ? "Retention Audit Completed" : "GPS Telemetry Purged",
        description: data.dryRun
          ? `Found ${data.recordsDeleted} raw GPS log records older than 7 days eligible for purge.`
          : `Successfully purged ${data.recordsDeleted} expired GPS records.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Purge Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const requests = data?.requests ?? [];
  const filtered = requests.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.customerName?.toLowerCase().includes(term) ||
      r.customerPhone?.includes(term) ||
      r.cityName?.toLowerCase().includes(term) ||
      r.branchName?.toLowerCase().includes(term) ||
      String(r.bookingId).includes(term) ||
      String(r.id).includes(term)
    );
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Supervisor Makeup Approvals
              </h1>
              {pendingCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Review and authorize customer replacement makeup requests exceeding complimentary quotas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
                refetchRetention();
              }}
              className="gap-1.5"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>
        </div>

        {/* GPS Retention Banner (PRIVACY-003) */}
        {retentionStats && (
          <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Shield size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  Automated GPS Retention Policy ({retentionStats.retentionDaysConfigured}-Day Purge Active)
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Raw telemetry older than {retentionStats.retentionDaysConfigured} days is purged every 6h via PG advisory lock.
                  {retentionStats.lastSuccessAt
                    ? ` Last run: ${new Date(retentionStats.lastSuccessAt).toLocaleString()} (${retentionStats.lastRecordsDeleted} purged).`
                    : " Scheduler standing by."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={purgeMutation.isPending}
                onClick={() => purgeMutation.mutate(true)}
              >
                Dry Run Audit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                disabled={purgeMutation.isPending}
                onClick={() => purgeMutation.mutate(false)}
              >
                <Trash2 size={12} className="mr-1" /> Purge Now
              </Button>
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/50 w-full sm:w-auto">
            {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors flex-1 sm:flex-none ${
                  statusFilter === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by customer, city, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading approval requests…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center border rounded-lg bg-card/40 space-y-2">
            <CheckCircle size={32} className="mx-auto text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No approval requests found</p>
            <p className="text-xs text-muted-foreground">
              {statusFilter === "pending"
                ? "All makeup requests are up to date! New requests exceeding complimentary quota will appear here."
                : `No requests with status '${statusFilter}'.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-card rounded-lg border border-border shadow-sm hover:border-border/80 transition-colors"
                data-testid={`approval-card-${req.id}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Customer & Service Context */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">
                        Request #{req.id}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                          req.status === "pending"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : req.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
                        }`}
                      >
                        {req.status}
                      </span>
                      {req.cityName && (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">
                          <MapPin size={10} /> {req.cityName} {req.branchName ? `· ${req.branchName}` : ""}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        Requested {new Date(req.createdAt).toLocaleDateString()} at{" "}
                        {new Date(req.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-center gap-3 text-xs text-foreground">
                      <span className="font-medium flex items-center gap-1">
                        <User size={12} className="text-muted-foreground" />
                        {req.customerName || "Customer"}
                      </span>
                      {req.customerPhone && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Phone size={12} /> {req.customerPhone}
                        </span>
                      )}
                    </div>

                    {/* Missed vs Replacement Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 bg-muted/40 rounded border border-border/40">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block">
                          Original Missed Booking #{req.bookingId}
                        </span>
                        <p className="font-medium text-foreground mt-0.5">
                          {req.originalDate} · {req.originalTime || "Time TBD"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {req.originalServiceType?.replace(/_/g, " ") ?? "Car Care"}
                          {req.originalAddress ? ` — ${req.originalAddress}` : ""}
                        </p>
                      </div>

                      <div className="p-2 bg-primary/5 rounded border border-primary/20">
                        <span className="text-[10px] uppercase font-bold text-primary tracking-wide block">
                          Requested Replacement
                        </span>
                        <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                          <Calendar size={12} className="text-primary" /> {req.requestedDate} · {req.requestedTime}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Quota: {req.previousMakeupsCount}/{req.applicableQuota} used (Exceeded Limit)
                        </p>
                      </div>
                    </div>

                    {/* Reason Notes */}
                    <div className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded">
                      <span className="font-medium text-foreground">Quota Reason:</span> {req.reason}
                      {req.requestedNotes && (
                        <span className="block mt-0.5 text-foreground">
                          <span className="font-medium">Customer Note:</span> {req.requestedNotes}
                        </span>
                      )}
                    </div>

                    {/* Decision Audit Trail if already decided */}
                    {req.status !== "pending" && (
                      <div className="text-xs pt-1 flex items-center gap-2 text-muted-foreground">
                        <Clock size={12} />
                        <span>
                          Decided on {req.decidedAt ? new Date(req.decidedAt).toLocaleString() : ""}
                          {req.decisionReason ? `: "${req.decisionReason}"` : ""}
                        </span>
                        {req.createdBookingId && (
                          <span className="font-medium text-primary">
                            · Created Booking #{req.createdBookingId}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  {req.status === "pending" && (
                    <div className="flex sm:flex-col items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 w-full sm:w-28 text-xs"
                        onClick={() => {
                          setApproveModal(req);
                          setApproveNotes("");
                        }}
                        data-testid={`btn-approve-${req.id}`}
                      >
                        <Check size={14} /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 gap-1 w-full sm:w-28 text-xs"
                        onClick={() => {
                          setRejectModal(req);
                          setRejectReason("");
                        }}
                        data-testid={`btn-reject-${req.id}`}
                      >
                        <X size={14} /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approve Modal */}
        {approveModal && (
          <Dialog open={Boolean(approveModal)} onOpenChange={(open) => !open && setApproveModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-500" />
                  Approve Makeup Request #{approveModal.id}
                </DialogTitle>
                <DialogDescription>
                  This will revalidate capacity and schedule replacement booking for{" "}
                  <strong>{approveModal.customerName}</strong> on{" "}
                  <strong>
                    {approveModal.requestedDate} ({approveModal.requestedTime})
                  </strong>
                  .
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Supervisor Approval Notes (Optional)
                  </label>
                  <Textarea
                    placeholder="e.g. Approved as courtesy for VIP customer / delayed service"
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setApproveModal(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ id: approveModal.id, notes: approveNotes })}
                >
                  {approveMutation.isPending ? "Validating & Confirming…" : "Confirm Approval"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Reject Modal */}
        {rejectModal && (
          <Dialog open={Boolean(rejectModal)} onOpenChange={(open) => !open && setRejectModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <XCircle size={18} />
                  Reject Makeup Request #{rejectModal.id}
                </DialogTitle>
                <DialogDescription>
                  A rejection reason is mandatory. The decision will be recorded in the audit log.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Rejection Reason <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    placeholder="e.g. Maximum monthly makeup visits reached; customer already provided 2 makeup visits this month."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    className="text-xs"
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setRejectModal(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={rejectMutation.isPending || !rejectReason.trim()}
                  onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason.trim() })}
                >
                  {rejectMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}
