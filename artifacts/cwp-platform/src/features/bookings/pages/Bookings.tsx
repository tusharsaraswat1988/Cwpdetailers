import { useState, useEffect } from "react";
import {
  useListBookings, getListBookingsQueryKey,
  useUpdateBooking, type ListBookingsParams,
  useTransitionBooking, useAddProof, useAssignBooking,
  useRescheduleBooking, useGetBookingEvents,
  useRequestUploadUrl,
  type ListBookingsStatus,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, User, ChevronLeft, ChevronRight, MapPin, Camera, Route, CheckCircle, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Can } from "@/components/Can";
import { PageHeader, FilterBar, DataTable, type Column } from "@/components/shared";
import { CustomerHubAdminNav } from "@/features/customers/components/CustomerHubAdminNav";
import { StaffAssignSelect } from "@/components/shared/StaffAssignSelect";
import { CustomerProfileLink } from "@/features/customers/components/CustomerProfileLink";
import { roleSlugForBookingService, OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";
import { format, isToday, parseISO } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  confirmed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  en_route: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  rescheduled: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

type B = {
  id: number; customerId?: number; customerName?: string; customerPhone?: string;
  serviceName?: string | null; serviceType?: string | null; staffName?: string | null;
  scheduledDate?: string; scheduledTime?: string | null; status?: string;
  area?: string | null; address?: string | null; amount?: string | number | null;
  proofPhotoUrls?: string[] | null;
};

export default function AdminBookings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [detailBooking, setDetailBooking] = useState<B | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [showAssign, setShowAssign] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(undefined);
  const limit = 15;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("customerId");
    setCustomerFilter(id ?? undefined);
  }, []);

  const params: ListBookingsParams = {
    status: statusFilter !== "all" ? (statusFilter as ListBookingsStatus) : undefined,
    limit,
    offset,
    ...(customerFilter ? { customerId: customerFilter } as ListBookingsParams : {}),
  };

  const { data, isLoading } = useListBookings(params, {
    query: { queryKey: getListBookingsQueryKey(params) },
  });

  const { data: events } = useGetBookingEvents(detailBooking?.id ?? 0, {
    query: { enabled: !!detailBooking?.id, queryKey: ["bookingEvents", detailBooking?.id] },
  });

  const updateMutation = useUpdateBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Booking updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const transitionMutation = useTransitionBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Status updated" });
      },
      onError: (e) => toast({ title: (e as any)?.response?.data?.error || "Transition failed", variant: "destructive" }),
    },
  });

  const assignMutation = useAssignBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Staff assigned" });
        setShowAssign(false);
      },
      onError: (e) => toast({ title: (e as any)?.response?.data?.error || "Assign failed", variant: "destructive" }),
    },
  });

  const rescheduleMutation = useRescheduleBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Rescheduled" });
        setShowReschedule(false);
      },
      onError: (e) => toast({ title: (e as any)?.response?.data?.error || "Reschedule failed", variant: "destructive" }),
    },
  });

  const columns: Column<B>[] = [
    {
      key: "customer", header: "Customer",
      cell: b => (
        <div className="flex items-center gap-2">
          <User size={13} className="text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">{b.customerName}</p>
            <p className="text-xs text-muted-foreground">{b.customerPhone}</p>
          </div>
        </div>
      ),
    },
    {
      key: "service", header: "Service",
      cell: b => (
        <div>
          <p className="text-foreground">{b.serviceName ?? b.serviceType?.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground capitalize">{b.serviceType?.replace(/_/g, " ")}</p>
        </div>
      ),
    },
    { key: "staff", header: "Staff", cell: b => <span className="text-muted-foreground">{b.staffName ?? "Unassigned"}</span> },
    {
      key: "datetime", header: "Date & Time",
      cell: b => (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-foreground"><Calendar size={11} className="text-muted-foreground" /><span>{b.scheduledDate}</span></div>
          {b.scheduledTime && <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Clock size={11} /><span>{b.scheduledTime}</span></div>}
        </div>
      ),
    },
    {
      key: "status", header: "Status",
      cell: b => <Badge variant="outline" className={`text-xs capitalize ${statusColors[b.status ?? "scheduled"]}`}>{b.status?.replace(/_/g, " ")}</Badge>,
    },
    { key: "amount", header: "Amount", align: "right", cell: b => b.amount ? <span className="font-medium text-foreground">₹{Number(b.amount).toLocaleString("en-IN")}</span> : <span className="text-muted-foreground">—</span> },
    {
      key: "action", header: "", align: "right",
      cell: b => (
        <Can resource="bookings" action="edit">
          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setDetailBooking(b)}>
            View
          </Button>
        </Can>
      ),
    },
  ];

  const statusFilters = ["all", "pending", "confirmed", "scheduled", "en_route", "in_progress", "completed", "cancelled", "rescheduled"];

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <CustomerHubAdminNav />
        <PageHeader title="Bookings" description={`${data?.total ?? 0} total bookings`} />

        {customerFilter && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
            <span>Showing bookings for customer #{customerFilter}</span>
            <Button variant="ghost" size="sm" onClick={() => { setCustomerFilter(undefined); window.history.replaceState({}, "", "/admin/bookings"); }}>
              Clear filter
            </Button>
          </div>
        )}

        <FilterBar>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-booking-status">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}</SelectItem>)}
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
            <span className="text-muted-foreground">Showing {offset + 1}–{Math.min(offset + limit, data?.total ?? 0)} of {data?.total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOffset(o => Math.max(0, o - limit))} disabled={offset === 0} data-testid="btn-prev-page"><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="sm" onClick={() => setOffset(o => o + limit)} disabled={offset + limit >= (data?.total ?? 0)} data-testid="btn-next-page"><ChevronRight size={14} /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {detailBooking && (
        <Dialog open onOpenChange={() => setDetailBooking(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Booking #{detailBooking.id}</span>
                <Badge variant="outline" className={`text-xs capitalize ${statusColors[detailBooking.status ?? "scheduled"]}`}>
                  {detailBooking.status?.replace(/_/g, " ")}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{detailBooking.customerName}</p>
                    {detailBooking.customerId && (
                      <CustomerProfileLink
                        customerId={detailBooking.customerId}
                        customerBasePath="/admin/customers"
                        name={detailBooking.customerName}
                        className="mt-2 h-7 text-xs"
                      />
                    )}
                  </div>
                  <div><p className="text-muted-foreground">Service</p><p className="font-medium">{detailBooking.serviceName ?? detailBooking.serviceType?.replace(/_/g, " ")}</p></div>
                  <div><p className="text-muted-foreground">Date</p><p className="font-medium">{detailBooking.scheduledDate}</p></div>
                  <div><p className="text-muted-foreground">Time</p><p className="font-medium">{detailBooking.scheduledTime ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Staff</p><p className="font-medium">{detailBooking.staffName ?? "Unassigned"}</p></div>
                  <div><p className="text-muted-foreground">Amount</p><p className="font-medium">{detailBooking.amount ? `₹${Number(detailBooking.amount).toLocaleString("en-IN")}` : "—"}</p></div>
                  {detailBooking.address && <div className="col-span-2"><p className="text-muted-foreground">Address</p><p className="font-medium">{detailBooking.address}</p></div>}
                  {detailBooking.area && <div className="col-span-2"><p className="text-muted-foreground">Area</p><p className="font-medium">{detailBooking.area}</p></div>}
                </div>
                {detailBooking.proofPhotoUrls && detailBooking.proofPhotoUrls.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-2">Proof Photos</p>
                    <div className="grid grid-cols-4 gap-2">
                      {detailBooking.proofPhotoUrls.map((url, i) => (
                        <img key={i} src={url} alt="Proof" className="rounded-lg h-20 w-full object-cover bg-muted" />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <div className="space-y-3">
                  {(events ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No events yet</p>
                  ) : (events ?? []).map((e: any) => (
                    <div key={e.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                      <div className="flex-1">
                        <p className="font-medium capitalize">{e.type.replace(/_/g, " ")}</p>
                        {e.fromStatus && e.toStatus && (
                          <p className="text-muted-foreground text-xs">{e.fromStatus} <ArrowRight size={10} className="inline" /> {e.toStatus}</p>
                        )}
                        {e.body && <p className="text-muted-foreground text-xs mt-0.5">{e.body}</p>}
                        {e.actorName && <p className="text-muted-foreground text-xs mt-0.5">by {e.actorName}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{e.createdAt ? format(parseISO(e.createdAt), "MMM d, h:mm a") : ""}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="actions" className="space-y-3 mt-4">
                <Can resource="bookings" action="edit">
                  {detailBooking.status === "scheduled" && (
                    <Button className="w-full" size="sm" onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "en_route" } })}>
                      <Route size={14} className="mr-2" /> En Route
                    </Button>
                  )}
                  {detailBooking.status === "en_route" && (
                    <Button className="w-full" size="sm" onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "in_progress" } })}>
                      <CheckCircle size={14} className="mr-2" /> Start Job
                    </Button>
                  )}
                  {detailBooking.status === "in_progress" && (
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "completed" } })}>
                      <CheckCircle size={14} className="mr-2" /> Mark Complete
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" size="sm" onClick={() => setShowReschedule(true)}>
                    <Calendar size={14} className="mr-2" /> Reschedule
                  </Button>
                  <Button variant="outline" className="w-full" size="sm" onClick={() => setShowAssign(true)}>
                    <User size={14} className="mr-2" /> Reassign Staff
                  </Button>
                  {detailBooking.status !== "cancelled" && detailBooking.status !== "completed" && (
                    <Button variant="destructive" className="w-full" size="sm" onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "cancelled", reason: "Cancelled by admin" } })}>
                      <XCircle size={14} className="mr-2" /> Cancel
                    </Button>
                  )}
                </Can>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Reschedule Dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule Booking</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
            <Textarea placeholder="Reason (optional)" value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReschedule(false)}>Cancel</Button>
            <Button onClick={() => rescheduleMutation.mutate({ id: detailBooking?.id ?? 0, data: { scheduledDate: rescheduleDate, reason: rescheduleReason } })} disabled={!rescheduleDate}>
              {rescheduleMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              data-testid="select-booking-staff"
            />
            <Textarea placeholder="Reason (optional)" value={assignReason} onChange={e => setAssignReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button onClick={() => assignMutation.mutate({ id: detailBooking?.id ?? 0, data: { staffId: parseInt(assignStaffId), reason: assignReason } })} disabled={!assignStaffId}>
              {assignMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
