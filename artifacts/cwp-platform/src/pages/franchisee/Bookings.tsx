import { useState } from "react";
import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import { useBranding } from "@/lib/branding";
import { useAuth } from "@/lib/auth";
import {
  useListBookings, getListBookingsQueryKey,
  useTransitionBooking,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, CheckCircle, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerProfileLink } from "@/features/customers/components/CustomerProfileLink";
import type { ListBookingsStatus } from "@workspace/api-client-react";

const statusColors: Record<string, string> = {
  draft: "bg-amber-500/10 text-amber-500",
  confirmed: "bg-blue-500/10 text-blue-400",
  scheduled: "bg-sky-500/10 text-sky-400",
  waiting_assignment: "bg-violet-500/10 text-violet-400",
  cancelled: "bg-red-500/10 text-red-400",
  rescheduled: "bg-orange-500/10 text-orange-400",
};

type B = {
  id: number;
  customerId?: number;
  customerName?: string;
  status?: string;
  serviceName?: string | null;
  serviceType?: string | null;
  scheduledDate?: string;
  scheduledTime?: string | null;
  address?: string | null;
  area?: string | null;
};

export default function FranchiseeBookings() {
  const branding = useBranding();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const branchId = user?.branchId ?? undefined;
  const [statusFilter, setStatusFilter] = useState<ListBookingsStatus | "">("");
  const [detailBooking, setDetailBooking] = useState<B | null>(null);

  const { data, isLoading } = useListBookings(
    { branchId, status: statusFilter || undefined, limit: 100 },
    {
      query: { queryKey: getListBookingsQueryKey({ branchId, status: statusFilter || undefined, limit: 100 }) },
    },
  );

  const filters = ["all", "draft", "scheduled", "confirmed", "waiting_assignment", "rescheduled", "cancelled"];

  const transitionMutation = useTransitionBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Status updated" });
      },
      onError: (e) => toast({
        title: (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Transition failed",
        variant: "destructive",
      }),
    },
  });

  const bookings = (data?.data ?? []) as B[];

  return (
    <FranchiseeLayout>
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: branding.primaryColor }}>Bookings</h1>
          <p className="text-sm text-muted-foreground">Schedule only — assign staff via Assign Service.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={(f === "all" && !statusFilter) || f === statusFilter ? "default" : "outline"}
              onClick={() => setStatusFilter(f === "all" ? "" : f as ListBookingsStatus)}
            >
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : bookings.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No bookings found</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <button
                key={b.id}
                type="button"
                className="w-full text-left rounded-lg border p-3 hover:bg-muted/40"
                onClick={() => setDetailBooking(b)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{b.customerName}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {b.serviceName ?? b.serviceType?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[b.status ?? "scheduled"] || "bg-muted text-muted-foreground"}`}>
                    {b.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar size={12} />{b.scheduledDate}</span>
                  {b.scheduledTime && <span className="flex items-center gap-1"><Clock size={12} />{b.scheduledTime}</span>}
                  {(b.area || b.address) && <span className="flex items-center gap-1"><MapPin size={12} />{b.area ?? b.address}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {detailBooking && (
        <Dialog open onOpenChange={() => setDetailBooking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Booking #{detailBooking.id}
                <Badge variant="outline" className={`text-xs capitalize ${statusColors[detailBooking.status ?? "scheduled"]}`}>
                  {detailBooking.status?.replace(/_/g, " ")}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{detailBooking.customerName}</p>
                {detailBooking.customerId && (
                  <CustomerProfileLink customerId={detailBooking.customerId} name={detailBooking.customerName} className="mt-1 h-7 text-xs" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground">Date</p><p className="font-medium">{detailBooking.scheduledDate}</p></div>
                <div><p className="text-muted-foreground">Time</p><p className="font-medium">{detailBooking.scheduledTime ?? "—"}</p></div>
              </div>
              {(detailBooking.status === "draft" || detailBooking.status === "scheduled" || detailBooking.status === "rescheduled") && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "confirmed" } })}
                >
                  {transitionMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle size={14} className="mr-2" />}
                  Confirm schedule
                </Button>
              )}
              {detailBooking.status === "waiting_assignment" && (
                <p className="text-xs text-muted-foreground text-center">
                  Ready for staff assignment (Assignment platform — Phase 5.3).
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </FranchiseeLayout>
  );
}
