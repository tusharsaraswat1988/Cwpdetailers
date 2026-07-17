import { useEffect, useMemo, useState } from "react";
import {
  useListBookings, getListBookingsQueryKey,
  type ListBookingsParams, type Booking, type BookingEvent,
  useTransitionBooking, useRescheduleBooking, useGetBookingEvents,
  type ListBookingsStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Calendar, Clock, User, CheckCircle, XCircle, ArrowRight, Loader2,
  ClipboardList, UserCog, RotateCcw, Ban, StickyNote, Car,
} from "lucide-react";
import { Can } from "@/components/Can";
import {
  PageTemplate, FilterBar, DataTable, StatusBadge, KpiRow, BulkActionBar,
  EntityDrawer, Timeline, ConfirmDialog, OfflineState,
  type Column, type KpiItem, type TimelineEvent,
} from "@/components/shared";
import { CustomerHubAdminNav } from "@/features/customers/components/CustomerHubAdminNav";
import { CustomerProfileLink } from "@/features/customers/components/CustomerProfileLink";
import { format, parseISO } from "date-fns";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const STATUS_FILTERS = ["all", "draft", "scheduled", "confirmed", "waiting_assignment", "rescheduled", "cancelled"] as const;

const EVENT_ICON: Partial<Record<BookingEvent["type"], TimelineEvent["icon"]>> = {
  status_change: ArrowRight,
  proof_upload: ClipboardList,
  reassign: UserCog,
  reschedule: RotateCcw,
  cancel: Ban,
  note: StickyNote,
};

function eventTone(e: BookingEvent): TimelineEvent["tone"] {
  if (e.type === "cancel") return "destructive";
  if (e.toStatus === "completed" || e.toStatus === "confirmed") return "success";
  if (e.type === "reschedule") return "warning";
  return "default";
}

export default function AdminBookings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateValue, setDateValue] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "datetime", direction: "desc" });
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [drawerBookingId, setDrawerBookingId] = useState<number | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(undefined);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [bulkCancelConfirm, setBulkCancelConfirm] = useState(false);
  const limit = 15;

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("customerId");
    setCustomerFilter(id ?? undefined);
  }, []);

  const params: ListBookingsParams = {
    status: statusFilter !== "all" ? (statusFilter as ListBookingsStatus) : undefined,
    date: dateValue,
    limit,
    offset: (page - 1) * limit,
    ...(customerFilter ? { customerId: Number(customerFilter) } as ListBookingsParams : {}),
  };

  const { data, isLoading, isError, refetch } = useListBookings(params, {
    query: { queryKey: getListBookingsQueryKey(params) },
  });

  // Lightweight counts for the KPI row — reuses the same list endpoint with limit:1,
  // since there's no dedicated bookings-stats endpoint (no backend change allowed).
  const { data: totalCount } = useListBookings({ limit: 1 }, { query: { queryKey: getListBookingsQueryKey({ limit: 1 }) } });
  const { data: waitingCount } = useListBookings(
    { status: "waiting_assignment" as ListBookingsStatus, limit: 1 },
    { query: { queryKey: getListBookingsQueryKey({ status: "waiting_assignment" as ListBookingsStatus, limit: 1 }) } },
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayCount } = useListBookings(
    { date: todayStr, limit: 1 },
    { query: { queryKey: getListBookingsQueryKey({ date: todayStr, limit: 1 }) } },
  );
  const { data: cancelledCount } = useListBookings(
    { status: "cancelled" as ListBookingsStatus, limit: 1 },
    { query: { queryKey: getListBookingsQueryKey({ status: "cancelled" as ListBookingsStatus, limit: 1 }) } },
  );

  const drawerBooking = useMemo(
    () => data?.data.find((b: Booking) => b.id === drawerBookingId) ?? null,
    [data, drawerBookingId],
  );

  const { data: events, isLoading: eventsLoading } = useGetBookingEvents(drawerBookingId ?? 0, {
    query: { enabled: !!drawerBookingId, queryKey: ["bookingEvents", drawerBookingId] },
  });

  const transitionMutation = useTransitionBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Status updated" });
      },
      onError: (e: unknown) => toast({ title: (e as any)?.response?.data?.error || "Transition failed", variant: "destructive" }),
    },
  });

  const rescheduleMutation = useRescheduleBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        toast({ title: "Rescheduled" });
        setShowReschedule(false);
      },
      onError: (e: unknown) => toast({ title: (e as any)?.response?.data?.error || "Reschedule failed", variant: "destructive" }),
    },
  });

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    const filtered = search.trim()
      ? list.filter((b: Booking) => {
          const q = search.trim().toLowerCase();
          return (
            b.customerName?.toLowerCase().includes(q) ||
            b.customerPhone?.toLowerCase().includes(q) ||
            b.serviceName?.toLowerCase().includes(q) ||
            String(b.id).includes(q)
          );
        })
      : list;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "id") cmp = a.id - b.id;
      else if (sort.key === "customer") cmp = (a.customerName ?? "").localeCompare(b.customerName ?? "");
      else if (sort.key === "datetime") cmp = (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "");
      else if (sort.key === "status") cmp = (a.status ?? "").localeCompare(b.status ?? "");
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, search, sort]);

  const columns: Column<Booking>[] = [
    {
      key: "id", header: "ID", sortable: true, hideable: true, defaultHidden: true,
      cell: b => <span className="text-muted-foreground">#{b.id}</span>,
    },
    {
      key: "customer", header: "Customer", sortable: true,
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
    {
      key: "staff", header: "Assignment", hideable: true,
      cell: b => (
        <span className="text-muted-foreground">
          {b.staffName ?? (b.status === "waiting_assignment" ? "Waiting assignment" : "—")}
        </span>
      ),
    },
    {
      key: "datetime", header: "Date & Time", sortable: true,
      cell: b => (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-foreground"><Calendar size={11} className="text-muted-foreground" /><span>{b.scheduledDate}</span></div>
          {b.scheduledTime && <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Clock size={11} /><span>{b.scheduledTime}</span></div>}
        </div>
      ),
    },
    {
      key: "status", header: "Status", sortable: true,
      cell: b => <StatusBadge status={b.status ?? "scheduled"} />,
    },
    {
      key: "action", header: "", align: "right", hideable: false, sticky: "right",
      cell: b => (
        <Can resource="bookings" action="edit">
          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setDrawerBookingId(b.id)}>
            View
          </Button>
        </Can>
      ),
    },
  ];

  const kpis: KpiItem[] = [
    { id: "total", label: "Total Bookings", value: totalCount?.total ?? "--", icon: ClipboardList },
    {
      id: "waiting", label: "Awaiting Assignment", value: waitingCount?.total ?? "--", icon: UserCog,
      tone: (waitingCount?.total ?? 0) > 0 ? "warning" : "default",
      onClick: () => { setStatusFilter("waiting_assignment"); setPage(1); },
    },
    { id: "today", label: "Scheduled Today", value: todayCount?.total ?? "--", icon: Calendar },
    { id: "cancelled", label: "Cancelled", value: cancelledCount?.total ?? "--", icon: Ban, tone: "destructive" },
  ];

  const timelineEvents: TimelineEvent[] = (events ?? []).map((e: BookingEvent) => ({
    id: e.id,
    title: e.type.replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase()),
    description: [
      e.fromStatus && e.toStatus ? `${e.fromStatus} → ${e.toStatus}` : undefined,
      e.body,
    ].filter(Boolean).join(" — ") || undefined,
    actor: e.actorName,
    timestamp: e.createdAt ? format(parseISO(e.createdAt), "MMM d, h:mm a") : undefined,
    icon: EVENT_ICON[e.type],
    tone: eventTone(e),
  }));

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateValue(undefined);
    setPage(1);
  };

  const hasActiveFilters = search !== "" || statusFilter !== "all" || !!dateValue;

  const runBulkTransition = async (toStatus: "confirmed" | "cancelled") => {
    const ids = selectedKeys as number[];
    await Promise.all(ids.map(id => transitionMutation.mutateAsync({ id, data: { toStatus, reason: toStatus === "cancelled" ? "Bulk cancelled by admin" : undefined } })));
    toast({ title: `${ids.length} booking(s) updated` });
    setSelectedKeys([]);
  };

  return (
    <PageTemplate
      title="Bookings"
      description="One-time wash, detailing & solar jobs. Monthly daily clean → Assign Service."
      breadcrumbs={[{ label: "Operations" }, { label: "Bookings" }]}
      stats={<KpiRow items={kpis} />}
      filters={
        <FilterBar
          search={search}
          onSearchChange={v => setSearch(v)}
          searchPlaceholder="Search by customer, phone, service, ID…"
          statusOptions={STATUS_FILTERS.map(s => ({ value: s, label: s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase()) }))}
          statusValue={statusFilter}
          onStatusChange={v => { setStatusFilter(v); setPage(1); }}
          onClearAll={hasActiveFilters ? clearFilters : undefined}
        >
          <Input
            type="date"
            value={dateValue ?? ""}
            onChange={e => { setDateValue(e.target.value || undefined); setPage(1); }}
            className="w-40"
            aria-label="Filter by scheduled date"
            data-testid="filter-booking-date"
          />
        </FilterBar>
      }
    >
      <CustomerHubAdminNav />

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

      {!isOnline ? (
        <OfflineState onRetry={() => refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            isLoading={isLoading}
            error={isError ? true : undefined}
            onRetry={() => refetch()}
            rowKey={r => r.id}
            onRowClick={b => setDrawerBookingId(b.id)}
            rowLabel={b => `View booking #${b.id} for ${b.customerName ?? "customer"}`}
            caption="Scheduled service bookings — date, time, location, and status"
            emptyTitle={hasActiveFilters ? "No bookings match your filters" : "No bookings found"}
            emptyDescription={hasActiveFilters ? "Try a different search, status or date, or clear filters to see all bookings." : "Bookings created via Book Services or customer schedule will show up here."}
            emptyAction={hasActiveFilters ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
            sort={{ key: sort.key, direction: sort.direction, onSortChange: (key, direction) => setSort({ key, direction }) }}
            selection={{ selectedKeys, onSelectionChange: setSelectedKeys }}
            enableColumnVisibility
            pagination={{
              page,
              pageSize: limit,
              total: data?.total ?? 0,
              onPageChange: setPage,
            }}
          />

          <BulkActionBar
            selectedCount={selectedKeys.length}
            onClear={() => setSelectedKeys([])}
            actions={[
              { id: "confirm", label: "Confirm", icon: <CheckCircle size={14} />, onClick: () => runBulkTransition("confirmed"), disabled: transitionMutation.isPending },
              { id: "cancel", label: "Cancel", icon: <XCircle size={14} />, variant: "destructive", onClick: () => setBulkCancelConfirm(true), disabled: transitionMutation.isPending },
            ]}
          />
        </>
      )}

      {/* Quick-view drawer */}
      <EntityDrawer
        open={!!drawerBookingId}
        onOpenChange={(open) => { if (!open) setDrawerBookingId(null); }}
        title={drawerBooking ? `Booking #${drawerBooking.id}` : "Booking"}
        description={drawerBooking?.customerName}
        status={drawerBooking?.status}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: drawerBooking && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Service</p><p className="font-medium">{drawerBooking.serviceName ?? drawerBooking.serviceType?.replace(/_/g, " ")}</p></div>
                <div><p className="text-muted-foreground">Date</p><p className="font-medium">{drawerBooking.scheduledDate}</p></div>
                <div><p className="text-muted-foreground">Time</p><p className="font-medium">{drawerBooking.scheduledTime ?? "—"}</p></div>
                <div><p className="text-muted-foreground">Assignment</p><p className="font-medium">{drawerBooking.staffName ?? (drawerBooking.status === "waiting_assignment" ? "Waiting for Assignment platform" : "—")}</p></div>
                {drawerBooking.amount != null && <div><p className="text-muted-foreground">Amount</p><p className="font-medium">₹{drawerBooking.amount.toLocaleString("en-IN")}</p></div>}
                {drawerBooking.address && <div className="col-span-2"><p className="text-muted-foreground">Address</p><p className="font-medium">{drawerBooking.address}</p></div>}
                {drawerBooking.area && <div className="col-span-2"><p className="text-muted-foreground">Area</p><p className="font-medium">{drawerBooking.area}</p></div>}
              </div>
            ),
          },
          {
            id: "customer",
            label: "Customer & Vehicle",
            content: drawerBooking && (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{drawerBooking.customerName}</p>
                  <p className="text-xs text-muted-foreground">{drawerBooking.customerPhone}</p>
                  {drawerBooking.customerId && (
                    <CustomerProfileLink
                      customerId={drawerBooking.customerId}
                      customerBasePath="/admin/customers"
                      name={drawerBooking.customerName}
                      className="mt-2 h-7 text-xs"
                    />
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Car size={14} className="text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Vehicle</p>
                    <p className="font-medium">{drawerBooking.vehicleInfo ?? "—"}</p>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "notes",
            label: "Notes",
            content: drawerBooking && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer notes</p>
                  <p className="font-medium">{drawerBooking.notes || "No notes"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Technician notes</p>
                  <p className="font-medium">{drawerBooking.technicianNotes || "—"}</p>
                </div>
                {drawerBooking.cancellationReason && (
                  <div>
                    <p className="text-muted-foreground">Cancellation reason</p>
                    <p className="font-medium">{drawerBooking.cancellationReason}</p>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            content: eventsLoading
              ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
              : <Timeline events={timelineEvents} />,
          },
          {
            id: "actions",
            label: "Actions",
            content: drawerBooking && (
              <Can resource="bookings" action="edit">
                <div className="space-y-3">
                  {(drawerBooking.status === "draft" || drawerBooking.status === "scheduled" || drawerBooking.status === "rescheduled") && (
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={transitionMutation.isPending}
                      onClick={() => transitionMutation.mutate({ id: drawerBooking.id, data: { toStatus: "confirmed" } })}
                    >
                      {transitionMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <CheckCircle size={14} className="mr-2" />} Confirm schedule
                    </Button>
                  )}
                  {(drawerBooking.status === "confirmed" || drawerBooking.status === "scheduled") && (
                    <Button
                      className="w-full"
                      size="sm"
                      variant="secondary"
                      disabled={transitionMutation.isPending}
                      onClick={() => transitionMutation.mutate({ id: drawerBooking.id, data: { toStatus: "waiting_assignment" } })}
                    >
                      {transitionMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <User size={14} className="mr-2" />} Mark waiting assignment
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
                  {drawerBooking.status !== "cancelled" && (
                    <Button variant="destructive" className="w-full" size="sm" onClick={() => setShowCancelConfirm(true)}>
                      <XCircle size={14} className="mr-2" /> Cancel booking
                    </Button>
                  )}
                </div>
              </Can>
            ),
          },
        ]}
      />

      {/* Cancel confirmation — prevents accidental destructive action */}
      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancel this booking?"
        description={`This will mark booking #${drawerBooking?.id} as cancelled and notify the customer. This action cannot be undone from here.`}
        confirmLabel="Yes, cancel booking"
        cancelLabel="Keep booking"
        destructive
        isConfirming={transitionMutation.isPending}
        onConfirm={() => {
          if (!drawerBooking) return;
          transitionMutation.mutate(
            { id: drawerBooking.id, data: { toStatus: "cancelled", reason: "Cancelled by admin" } },
            { onSuccess: () => setShowCancelConfirm(false) },
          );
        }}
      />

      {/* Bulk cancel confirmation */}
      <ConfirmDialog
        open={bulkCancelConfirm}
        onOpenChange={setBulkCancelConfirm}
        title={`Cancel ${selectedKeys.length} booking(s)?`}
        description="Selected bookings will be marked as cancelled and customers notified. This action cannot be undone from here."
        confirmLabel="Yes, cancel selected"
        cancelLabel="Keep bookings"
        destructive
        isConfirming={transitionMutation.isPending}
        onConfirm={async () => {
          await runBulkTransition("cancelled");
          setBulkCancelConfirm(false);
        }}
      />

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
            <Button onClick={() => rescheduleMutation.mutate({ id: drawerBooking?.id ?? 0, data: { scheduledDate: rescheduleDate, reason: rescheduleReason } })} disabled={!rescheduleDate || rescheduleMutation.isPending}>
              {rescheduleMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTemplate>
  );
}
