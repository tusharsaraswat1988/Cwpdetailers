import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Trash2,
  UserX,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  CalendarCheck,
  CreditCard,
  Briefcase,
  FileText,
  Clock,
} from "lucide-react";
import {
  staffEcosystemApi,
  STAFF_ECOSYSTEM_QUERY_KEY,
} from "@/lib/staff-ecosystem/api";
import { getListStaffQueryKey } from "@workspace/api-client-react";

export interface StaffDeleteModalProps {
  staff: {
    id: number;
    name: string;
    employeeCode?: string | null;
    isActive?: boolean;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function StaffDeleteModal({
  staff,
  open,
  onOpenChange,
  onSuccess,
}: StaffDeleteModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const staffId = staff?.id ?? 0;

  const {
    data: checkData,
    isLoading: isChecking,
    error: checkError,
    refetch,
  } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "deletion-check", staffId],
    queryFn: () => staffEcosystemApi.checkDeletion(staffId),
    enabled: open && staffId > 0,
  });

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!staff) return;
      return staffEcosystemApi.deleteStaff(staff.id, false);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY] });
      toast({
        title: "Staff member deleted",
        description: data?.message || "Staff member was permanently deleted.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to delete staff member",
        description: err.message,
        variant: "destructive",
      });
      refetch();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (!staff) return;
      return staffEcosystemApi.deactivateStaff(staff.id, reason.trim() || undefined);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
      qc.invalidateQueries({ queryKey: [STAFF_ECOSYSTEM_QUERY_KEY] });
      toast({
        title: "Staff member deactivated",
        description:
          data?.message ||
          "Staff member deactivated, login revoked, and unassigned from active routes.",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to deactivate staff member",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!staff) return null;

  const canDelete = checkData?.canDelete ?? false;
  const hasHistory = checkData?.hasHistory ?? false;
  const counts = checkData?.counts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {canDelete ? (
              <div className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <Trash2 size={20} />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
            )}
            <div>
              <DialogTitle className="text-lg">
                {canDelete ? "Delete Staff Member" : "Staff Offboarding & Deactivation"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {staff.name} {staff.employeeCode ? `(${staff.employeeCode})` : `· ID #${staff.id}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isChecking ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Checking operational and financial history...</p>
          </div>
        ) : checkError ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <p className="font-semibold">Unable to verify operational history</p>
            <p className="mt-1">{(checkError as Error).message}</p>
          </div>
        ) : canDelete ? (
          // Case 1: Safe Permanent Deletion (0 History)
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                <AlertTriangle size={15} />
                <span>Zero Operational History Found</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This staff member has never completed any service visits, attendance punch-ins, or financial transactions.
                Permanent deletion will remove this profile and all login accounts safely from the database.
              </p>
            </div>
            <p className="text-xs text-foreground font-medium">
              Are you sure you want to permanently remove <span className="font-bold">{staff.name}</span>?
              This action cannot be undone.
            </p>
          </div>
        ) : (
          // Case 2: Has Operational Records (Must Deactivate / Offboard)
          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-xs">
                <AlertTriangle size={15} />
                <span>Permanent Delete Blocked — Historical Records Exist</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                To protect customer service delivery proof, salary calculations, and financial audit trails, staff members with historical records cannot be hard deleted.
              </p>
            </div>

            {/* Counts Breakdown Grid */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Linked Operational Records ({checkData?.totalHistoricalRecords ?? 0})
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-background border">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase size={13} className="text-sky-600" />
                    <span>Completed Jobs</span>
                  </span>
                  <Badge variant="secondary" className="font-bold">
                    {(counts?.serviceExecutions ?? 0) + (counts?.completedBookings ?? 0)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={13} className="text-emerald-600" />
                    <span>DCMS Visits</span>
                  </span>
                  <Badge variant="secondary" className="font-bold">
                    {counts?.dcmsVisits ?? 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarCheck size={13} className="text-violet-600" />
                    <span>Attendance Records</span>
                  </span>
                  <Badge variant="secondary" className="font-bold">
                    {counts?.attendance ?? 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-background border">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CreditCard size={13} className="text-amber-600" />
                    <span>Payouts & Invoices</span>
                  </span>
                  <Badge variant="secondary" className="font-bold">
                    {(counts?.payouts ?? 0) + (counts?.invoices ?? 0)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* What deactivation does */}
            <div className="space-y-1.5 text-xs text-muted-foreground bg-background rounded-lg border p-3">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Recommended Action: Deactivate & Offboard Staff</span>
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                <li>Immediately invalidates staff mobile portal login and sessions.</li>
                <li>Unassigns from active daily cleaning routes so cars are reassigned.</li>
                <li>Preserves historical job photos, ratings, and attendance audits.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="offboard-reason" className="text-xs">
                Reason for offboarding (optional)
              </Label>
              <Textarea
                id="offboard-reason"
                placeholder="e.g. Resigned, Contract ended, Relocated to another city..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending || deactivateMutation.isPending}
          >
            Cancel
          </Button>

          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || isChecking}
              className="gap-1.5"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  <span>Permanently Delete</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending || isChecking}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              {deactivateMutation.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Offboarding...</span>
                </>
              ) : (
                <>
                  <UserX size={13} />
                  <span>Deactivate & Offboard</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
