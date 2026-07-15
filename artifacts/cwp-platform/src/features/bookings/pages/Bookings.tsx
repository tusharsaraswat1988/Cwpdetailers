import { useState, useEffect } from "react";
import {
  useListBookings, getListBookingsQueryKey,
  type ListBookingsParams,
  useTransitionBooking, useRescheduleBooking, useGetBookingEvents,
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Calendar, Clock, User, ChevronLeft, ChevronRight, Route, CheckCircle, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Can } from "@/components/Can";
import { PageHeader, FilterBar, DataTable, type Column } from "@/components/shared";
import { CustomerHubAdminNav } from "@/features/customers/components/CustomerHubAdminNav";
import { CustomerProfileLink } from "@/features/customers/components/CustomerProfileLink";
import { format, parseISO } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  confirmed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  en_route: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  rescheduled: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  missed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
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
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(undefined);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
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

  const transitionMutation = useTransitionBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Status updated" });
      },
      onError: (e) => toast({ title: (e as any)?.response?.data?.error || "Transition failed", variant: "destructive" }),
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

  const statusFilters = ["all", "pending", "confirmed", "scheduled", "en_route", "in_progress", "completed", "cancelled", "rescheduled", "missed"];

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <CustomerHubAdminNav />
        <PageHeader
          title="Bookings"
          description="One-time wash, detailing & solar jobs. Monthly daily clean → Assign Service."
        />

        <Alert>
          <AlertDescription className="text-sm">
            Monthly daily cleaning (₹1600 plans) is managed in{" "}
            <Link href="/admin/assign-services" className="font-medium text-primary underline underline-offset-2">
              Assign Service
            </Link>
            {" "}and{" "}
            <Link href="/admin/daily-cleaning/subscriptions" className="font-medium text-primary underline underline-offset-2">
              Daily Clean subscriptions
            </Link>
            . This list shows doorstep one-time jobs only.
          </AlertDescription>
        </Alert>

        {customerFilter && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
            <span>Showing bookings for customer #{customerFilter}</span>
            <Button variant="ghost" size="sm" onClick={() => { setCustomerFilter(undefined); window.history.replaceState({}, "", "/admin/bookings"); }}>
              Clear filter
            </Button>
          </div>
        )}

        <FilterBar>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-40" aria-label="Filter bookings by status" data-testid="select-booking-status">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map(s => <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}</SelectItem>)}
            </SelectContent>
          </Select>
          {statusFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setOffset(0); }}>
              Reset
            </Button>
          )}
        </FilterBar>

        <DataTable
          columns={columns}
          rows={data?.data as B[] | undefined}
          isLoading={isLoading}
          rowKey={r => r.id}
          onRowClick={b => setDetailBooking(b)}
          rowLabel={b => `View booking #${b.id} for ${b.customerName ?? "customer"}`}
          caption="List of service bookings with customer, service, staff, schedule, status and amount"
          emptyTitle={statusFilter !== "all" ? `No ${statusFilter.replace(/_/g, " ")} bookings` : "No bookings found"}
          emptyDescription={statusFilter !== "all" ? "Try a different status filter, or reset filters to see all bookings." : "Bookings created via the booking wizard will show up here."}
          emptyAction={statusFilter !== "all" ? <Button size="sm" variant="outline" onClick={() => { setStatusFilter("all"); setOffset(0); }}>Reset filter</Button> : undefined}
        />

        <div className="flex items-center justify-between text-sm" aria-live="polite">
          <span className="text-muted-foreground">
            {(data?.total ?? 0) > 0
              ? `Showing ${offset + 1}–${Math.min(offset + limit, data?.total ?? 0)} of ${data?.total}`
              : ""}
          </span>
          {(data?.total ?? 0) > limit && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOffset(o => Math.max(0, o - limit))} disabled={offset === 0} aria-label="Previous page" data-testid="btn-prev-page"><ChevronLeft size={14} /></Button>
              <Button variant="outline" size="sm" onClick={() => setOffset(o => o + limit)} disabled={offset + limit >= (data?.total ?? 0)} aria-label="Next page" data-testid="btn-next-page"><ChevronRight size={14} /></Button>
            </div>
          )}
        </div>
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
                    <Button className="w-full" size="sm" disabled={transitionMutation.isPending} onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "en_route" } })}>
                      {transitionMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Route size={14} className="mr-2" />} En Route
                    </Button>
                  )}
                  {detailBooking.status === "en_route" && (
                    <Button className="w-full" size="sm" disabled={transitionMutation.isPending} onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "in_progress" } })}>
                      {transitionMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle size={14} className="mr-2" />} Start Job
                    </Button>
                  )}
                  {detailBooking.status === "in_progress" && (
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm" disabled={transitionMutation.isPending} onClick={() => transitionMutation.mutate({ id: detailBooking.id, data: { toStatus: "completed" } })}>
                      {transitionMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle size={14} className="mr-2" />} Mark Complete
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" size="sm" onClick={() => { setRescheduleDate(""); setRescheduleReason(""); setShowReschedule(true); }}>
                    <Calendar size={14} className="mr-2" /> Reschedule
                  </Button>
                  <Link href="/admin/assign-services" className="block">
                    <Button variant="outline" className="w-full" size="sm" type="button">
                      <User size={14} className="mr-2" /> Assign staff (Assign Service)
                    </Button>
                  </Link>
                  {detailBooking.status !== "cancelled" && detailBooking.status !== "completed" && (
                    <Button variant="destructive" className="w-full" size="sm" onClick={() => setShowCancelConfirm(true)}>
                      <XCircle size={14} className="mr-2" /> Cancel booking
                    </Button>
                  )}
                </Can>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel confirmation — prevents accidental destructive action */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark booking #{detailBooking?.id} as cancelled and notify the customer. This action cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={transitionMutation.isPending}
              onClick={() => {
                if (!detailBooking) return;
                transitionMutation.mutate(
                  { id: detailBooking.id, data: { toStatus: "cancelled", reason: "Cancelled by admin" } },
                  { onSuccess: () => setShowCancelConfirm(false) },
                );
              }}
            >
              {transitionMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null} Yes, cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="reschedule-date" className="text-sm font-medium text-foreground">New date</label>
              <Input id="reschedule-date" type="date" min={new Date().toISOString().slice(0, 10)} value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} required aria-required="true" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reschedule-reason" className="text-sm font-medium text-foreground">Reason (optional)</label>
              <Textarea id="reschedule-reason" placeholder="e.g. Customer requested a later slot" value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReschedule(false)}>Cancel</Button>
            <Button onClick={() => rescheduleMutation.mutate({ id: detailBooking?.id ?? 0, data: { scheduledDate: rescheduleDate, reason: rescheduleReason } })} disabled={!rescheduleDate || rescheduleMutation.isPending}>
              {rescheduleMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
