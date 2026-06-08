import { useState } from "react";
import { useListBookings, getListBookingsQueryKey, useUpdateBooking, type ListBookingsParams, type UpdateBookingBody } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Can } from "@/components/Can";
import { PageHeader, FilterBar, DataTable, type Column } from "@/components/shared";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

type B = {
  id: number; customerName?: string; customerPhone?: string;
  serviceName?: string | null; serviceType?: string | null; staffName?: string | null;
  scheduledDate?: string; scheduledTime?: string | null;
  status?: string; amount?: string | number | null;
};

export default function AdminBookings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 15;

  const params: ListBookingsParams = {
    status: statusFilter !== "all" ? (statusFilter as ListBookingsParams["status"]) : undefined,
    limit,
    offset,
  };

  const { data, isLoading } = useListBookings(params, { query: { queryKey: getListBookingsQueryKey(params) } });

  const updateMutation = useUpdateBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Booking updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const columns: Column<B>[] = [
    {
      key: "customer", header: "Customer",
      cell: b => (
        <div className="flex items-center gap-2">
          <User size={13} className="text-white/40" />
          <div>
            <p className="font-medium text-white">{b.customerName}</p>
            <p className="text-xs text-white/50">{b.customerPhone}</p>
          </div>
        </div>
      ),
    },
    {
      key: "service", header: "Service",
      cell: b => (
        <div>
          <p className="text-white/80">{b.serviceName ?? b.serviceType?.replace(/_/g, " ")}</p>
          <p className="text-xs text-white/50 capitalize">{b.serviceType?.replace(/_/g, " ")}</p>
        </div>
      ),
    },
    { key: "staff", header: "Staff", cell: b => <span className="text-white/60">{b.staffName ?? "Unassigned"}</span> },
    {
      key: "datetime", header: "Date & Time",
      cell: b => (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-white/80"><Calendar size={11} className="text-white/40" /><span>{b.scheduledDate}</span></div>
          {b.scheduledTime && <div className="flex items-center gap-1.5 text-xs text-white/50 mt-0.5"><Clock size={11} /><span>{b.scheduledTime}</span></div>}
        </div>
      ),
    },
    {
      key: "status", header: "Status",
      cell: b => <Badge variant="outline" className={`text-xs capitalize ${statusColors[b.status ?? "pending"]}`}>{b.status?.replace(/_/g, " ")}</Badge>,
    },
    { key: "amount", header: "Amount", align: "right", cell: b => b.amount ? <span className="font-medium text-white">₹{Number(b.amount).toLocaleString("en-IN")}</span> : <span className="text-white/30">—</span> },
    {
      key: "action", header: "", align: "right",
      cell: b => (
        <Can resource="bookings" action="edit">
          {b.status === "pending" && (
            <Button size="sm" variant="outline" className="text-xs h-7 px-2"
              data-testid={`btn-confirm-booking-${b.id}`}
              onClick={() => updateMutation.mutate({ id: b.id, data: { status: "confirmed" } satisfies UpdateBookingBody })}>
              Confirm
            </Button>
          )}
          {b.status === "confirmed" && (
            <Button size="sm" className="text-xs h-7 px-2 bg-primary text-secondary hover:bg-primary/90"
              data-testid={`btn-complete-booking-${b.id}`}
              onClick={() => updateMutation.mutate({ id: b.id, data: { status: "completed" } satisfies UpdateBookingBody })}>
              Complete
            </Button>
          )}
        </Can>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageHeader title="Bookings" description={`${data?.total ?? 0} total bookings`} />

        <FilterBar>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white" data-testid="select-booking-status">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data as B[] | undefined}
          isLoading={isLoading}
          rowKey={r => r.id}
          emptyTitle="No bookings found"
          emptyDescription="Try a different status filter."
        />

        {(data?.total ?? 0) > limit && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Showing {offset + 1}–{Math.min(offset + limit, data?.total ?? 0)} of {data?.total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOffset(o => Math.max(0, o - limit))} disabled={offset === 0} data-testid="btn-prev-page">
                <ChevronLeft size={14} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOffset(o => o + limit)} disabled={offset + limit >= (data?.total ?? 0)} data-testid="btn-next-page">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
