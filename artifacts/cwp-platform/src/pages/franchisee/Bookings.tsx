import { useState } from "react";
import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import { useBranding } from "@/lib/branding";
import { useAuth } from "@/lib/auth";
import {
  useListBookings, getListBookingsQueryKey,
  useTransitionBooking, useUpdateBooking,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle, MapPin, Route, ArrowRight, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StaffAssignSelect } from "@/components/shared/StaffAssignSelect";
import { CustomerProfileLink } from "@/features/customers/components/CustomerProfileLink";
import { roleSlugForBookingService, OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";
import type { ListBookingsStatus } from "@workspace/api-client-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500",
  confirmed: "bg-blue-500/10 text-blue-400",
  scheduled: "bg-sky-500/10 text-sky-400",
  en_route: "bg-orange-500/10 text-orange-400",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-green-500/10 text-green-500",
  cancelled: "bg-red-500/10 text-red-400",
  rescheduled: "bg-violet-500/10 text-violet-400",
};

type B = { id: number; customerId?: number; customerName?: string; status?: string; serviceName?: string | null; serviceType?: string | null; scheduledDate?: string; scheduledTime?: string | null; staffName?: string | null; address?: string | null; area?: string | null; amount?: string | number | null };

export default function FranchiseeBookings() {
  const branding = useBranding();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const branchId = user?.branchId ?? undefined;
  const [statusFilter, setStatusFilter] = useState<ListBookingsStatus | "">("");
  const [detailBooking, setDetailBooking] = useState<B | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignReason, setAssignReason] = useState("");

  const { data, isLoading } = useListBookings({
    branchId,
    status: statusFilter || undefined,
    limit: 100,
  }, {
    query: { queryKey: getListBookingsQueryKey({ branchId, status: statusFilter || undefined, limit: 100 }) },
  });
  const bookings = (data?.data ?? []) as B[];

  const filters = ["all", "pending", "confirmed", "scheduled", "en_route", "in_progress", "completed", "cancelled", "rescheduled"];

  const transitionMutation = useTransitionBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Status updated" });
        setDetailBooking(null);
      },
      onError: (e: any) => toast({ title: e?.response?.data?.error || "Transition failed", variant: "destructive" }),
    },
  });

  const assignMutation = useUpdateBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Staff assigned" });
        setShowAssign(false);
      },
      onError: (e: any) => toast({ title: e?.response?.data?.error || "Assign failed", variant: "destructive" }),
    },
  });

  return (
    <FranchiseeLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Booking Requests</h1>
            <p className="text-muted-foreground text-sm mt-1">Review and track customer bookings in your city</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5 text-sm text-amber-600">
          <strong>Note:</strong> All payments are collected and settled by {branding.brandName} Admin. Your role is to coordinate job scheduling and staff dispatch.
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {filters.map(f => (
            <button key={f}
              onClick={() => setStatusFilter(f === "all" ? "" : (f as ListBookingsStatus))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                (f === "all" && !statusFilter) || f === statusFilter
                  ? "bg-primary text-secondary"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}>
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : bookings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No bookings found</div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="px-5 py-4 flex items-start gap-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setDetailBooking(b)}>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{b.customerName || `Customer #${b.customerId}`}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[b.status ?? "scheduled"] || "bg-muted text-muted-foreground"}`}>
                        {b.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.serviceName || b.serviceType?.replace(/_/g, " ")}</p>
                    <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock size={10} /> {b.scheduledDate} {b.scheduledTime ? `· ${b.scheduledTime}` : ""}</span>
                      {b.staffName && <span className="flex items-center gap-1"><User size={10} /> {b.staffName}</span>}
                      {b.amount && <span>₹{Number(b.amount).toLocaleString("en-IN")}</span>}
                    </div>
                    {b.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin size={10} />
                        <span>{b.area ? `${b.area}, ${b.address}` : b.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      {detailBooking && (
        <Dialog open onOpenChange={() => setDetailBooking(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Booking #{detailBooking.id}</span>
                <Badge variant="outline" className={`text-xs capitalize ${statusColors[detailBooking.status ?? "scheduled"]}`}>
                  {detailBooking.status?.replace(/_/g, " ")}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{detailBooking.customerName}</p>
                  {detailBooking.customerId && (
                    <CustomerProfileLink
                      customerId={detailBooking.customerId}
                      customerBasePath="/franchisee/customers"
                      name={detailBooking.customerName}
                      className="mt-2 h-7 text-xs"
                    />
                  )}
                </div>
                <div><p className="text-muted-foreground">Service</p><p className="font-medium">{detailBooking.serviceName ?? detailBooking.serviceType?.replace(/_/g, " ")}</p></div>
                <div><p className="text-muted-foreground">Date</p><p className="font-medium">{detailBooking.scheduledDate}</p></div>
                <div><p className="text-muted-foreground">Staff</p><p className="font-medium">{detailBooking.staffName ?? "Unassigned"}</p></div>
              </div>
              {detailBooking.address && (
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <MapPin size={10} /> {detailBooking.area ? `${detailBooking.area}, ${detailBooking.address}` : detailBooking.address}
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap mt-4">
              {detailBooking.status === "scheduled" && (
                <Button size="sm" variant="outline" onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "en_route" } })}>
                  <Route size={12} className="mr-1" /> En Route
                </Button>
              )}
              {detailBooking.status === "en_route" && (
                <Button size="sm" className="bg-primary text-secondary hover:bg-primary/90" onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "in_progress" } })}>
                  <ArrowRight size={12} className="mr-1" /> Start
                </Button>
              )}
              {detailBooking.status === "in_progress" && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "completed" } })}>
                  <CheckCircle size={12} className="mr-1" /> Complete
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowAssign(true)}>
                <User size={12} className="mr-1" /> Assign Staff
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Staff</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <StaffAssignSelect
              roleSlug={roleSlugForBookingService(detailBooking?.serviceType) ?? OPERATIONAL_ROLE_SLUGS.CAR_WASHER}
              value={assignStaffId}
              onValueChange={setAssignStaffId}
              placeholder="Select qualified staff"
            />
            <Textarea placeholder="Reason (optional)" value={assignReason} onChange={e => setAssignReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button onClick={() => assignMutation.mutate({ id: detailBooking?.id ?? 0, data: { staffId: parseInt(assignStaffId, 10) } })} disabled={!assignStaffId}>
              {assignMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FranchiseeLayout>
  );
}
