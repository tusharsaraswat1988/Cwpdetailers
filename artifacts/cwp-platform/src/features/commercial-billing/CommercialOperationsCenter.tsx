import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetCustomer } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FilterBar, DataTable, StatusBadge, KpiRow, BulkActionBar, EntityDrawer,
  Timeline, ActivityFeed, ConfirmDialog, ActionBar,
  type Column, type KpiItem, type TimelineEvent, type ActivityItem, type ActionBarAction,
} from "@/components/shared";
import { CreateCreditNoteDialog } from "@/features/billing/components/CreateCreditNoteDialog";
import { InvoicePdfButton } from "@/features/billing/components/InvoicePdfButton";
import {
  COMMERCIAL_BILLING_QUERY_KEY,
  billingModeLabel,
  commercialStatusLabel,
  fetchCommercialInvoiceDetail,
  fetchCommercialInvoices,
  fetchReadyForBilling,
  generateJobInvoice,
  invoicePdfUrl,
  issueCommercialInvoice,
  markCommercialInvoicePaid,
  paymentStageIndex,
  previewJobInvoice,
  voidCommercialInvoice,
  PAYMENT_STAGES,
  type CommercialInvoice,
  type CommercialPreview,
  type CommercialTimelineEntry,
  type InvoiceCommercialStatus,
  type ReadyForBillingRow,
} from "./api";
import {
  Receipt, FileText, CheckCircle2, Ban, Download, Eye, Loader2,
  ArrowRight, IndianRupee, FilePlus2, Clock, AlertTriangle, History,
} from "lucide-react";

const PAGE_SIZE = 15;
const AGGREGATE_LIMIT = 100; // backend caps limit at 100 — see billing routes contract; counts above this are labelled "100+" rather than fabricated.

const STATUS_OPTIONS: { value: InvoiceCommercialStatus | "outstanding" | "all"; label: string }[] = [
  { value: "all", label: "All Invoices" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "payment_pending", label: "Payment Pending" },
  { value: "outstanding", label: "Outstanding" },
  { value: "paid", label: "Paid" },
  { value: "commercially_closed", label: "Commercially Closed" },
  { value: "voided", label: "Voided" },
];

const COMMERCIAL_BUSINESS_EVENTS = new Set([
  "COMMERCIAL_PREVIEWED", "INVOICE_DRAFT_CREATED", "INVOICE_ISSUED",
  "INVOICE_PAYMENT_PENDING", "INVOICE_PAID", "COMMERCIAL_CLOSED",
]);

const TIMELINE_ICON: Record<string, TimelineEvent["icon"]> = {
  COMMERCIAL_PREVIEWED: Eye,
  INVOICE_DRAFT_CREATED: FilePlus2,
  INVOICE_ISSUED: Receipt,
  INVOICE_PAYMENT_PENDING: Clock,
  INVOICE_PAID: IndianRupee,
  COMMERCIAL_CLOSED: CheckCircle2,
  INVOICE_VOIDED: Ban,
  INVOICE_CANCELLED: Ban,
  CREDIT_NOTE_CREATED: FileText,
  ENTITLEMENT_CONSUMED: History,
};

function timelineTone(entry: CommercialTimelineEntry): TimelineEvent["tone"] {
  if (entry.eventType === "INVOICE_VOIDED" || entry.eventType === "INVOICE_CANCELLED") return "destructive";
  if (entry.eventType === "INVOICE_PAID" || entry.eventType === "COMMERCIAL_CLOSED") return "success";
  if (entry.eventType === "INVOICE_PAYMENT_PENDING") return "warning";
  return "info";
}

function formatMoney(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function daysOverdue(dueDate: string | null | undefined): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return 0;
  return Math.floor((Date.now() - due) / 86_400_000);
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** Resolves a customer name for a commercial invoice row — the commercial
 * endpoint returns raw invoice rows (no customer join) by design (backend
 * unchanged per Phase 2.5 scope), so this reuses the existing per-id
 * customer lookup (react-query dedupes repeats across the table). */
function CustomerCell({ customerId }: { customerId: number }) {
  const { data, isLoading } = useGetCustomer(customerId, { query: { enabled: customerId > 0 } });
  if (isLoading) return <span className="text-muted-foreground text-xs">Loading…</span>;
  return <span>{data?.name ?? `Customer #${customerId}`}</span>;
}

/** Visual payment progression — Draft → Issued → Outstanding → Paid → Closed.
 * Local render helper (not a new shared component) per UI Constitution
 * §"extend, don't fork": StatusBadge remains the only status-color source. */
function PaymentProgress({ status }: { status: InvoiceCommercialStatus | null | undefined }) {
  if (status === "voided") return <StatusBadge status="voided" />;
  const idx = paymentStageIndex(status);
  return (
    <div className="flex items-center gap-1" aria-label={`Payment stage: ${status ?? "unknown"}`}>
      {PAYMENT_STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1">
          <span
            className={
              "h-2 w-2 rounded-full " +
              (i <= idx ? (i === idx ? "bg-primary" : "bg-primary/50") : "bg-muted")
            }
            title={stage}
          />
          {i < PAYMENT_STAGES.length - 1 && <span className="h-px w-2.5 bg-border" />}
        </div>
      ))}
    </div>
  );
}

export function CommercialOperationsCenter() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const queue1Ref = useRef<HTMLDivElement>(null);

  // Queue 2 — Invoice & Collections state
  const [search, setSearch] = useState("");
  const [statusValue, setStatusValue] = useState<InvoiceCommercialStatus | "outstanding" | "all">("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);

  // Drawer / dialogs
  const [drawerInvoiceId, setDrawerInvoiceId] = useState<number | null>(null);
  const [preview, setPreview] = useState<CommercialPreview | null>(null);
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [voidTarget, setVoidTarget] = useState<CommercialInvoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [markPaidTarget, setMarkPaidTarget] = useState<CommercialInvoice | null>(null);
  const [markPaidAmount, setMarkPaidAmount] = useState("");
  const [creditNoteTarget, setCreditNoteTarget] = useState<CommercialInvoice | null>(null);
  const [bulkIssueConfirm, setBulkIssueConfirm] = useState(false);
  const [bulkMarkPaidConfirm, setBulkMarkPaidConfirm] = useState(false);

  const invalidate = () => void qc.invalidateQueries({ queryKey: COMMERCIAL_BILLING_QUERY_KEY });

  // ---- Ready for Billing (Queue 1) -----------------------------------------
  const readyQuery = useQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, "ready"],
    queryFn: () => fetchReadyForBilling(AGGREGATE_LIMIT, 0),
  });

  // ---- Aggregate counts for KPIs + Commercial Handoff (best-effort, capped at 100 rows per status — see AGGREGATE_LIMIT) ----
  const draftAggQuery = useQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, "agg", "draft"],
    queryFn: () => fetchCommercialInvoices("draft", AGGREGATE_LIMIT, 0),
  });
  const outstandingAggQuery = useQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, "agg", "outstanding"],
    queryFn: () => fetchCommercialInvoices("outstanding", AGGREGATE_LIMIT, 0),
  });
  const closedAggQuery = useQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, "agg", "closed"],
    queryFn: () => fetchCommercialInvoices("commercially_closed", AGGREGATE_LIMIT, 0),
  });

  const overdueItems = useMemo(
    () => (outstandingAggQuery.data?.items ?? []).filter(inv => daysOverdue(inv.dueDate) > 0),
    [outstandingAggQuery.data],
  );
  const collectedTodayTotal = useMemo(
    () => (closedAggQuery.data?.items ?? [])
      .filter(inv => isToday(inv.commerciallyClosedAt) || isToday(inv.paidAt))
      .reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0),
    [closedAggQuery.data],
  );
  const pendingCollectionTotal = useMemo(
    () => (outstandingAggQuery.data?.items ?? []).reduce((sum, inv) => sum + parseFloat(inv.balanceDue || "0"), 0),
    [outstandingAggQuery.data],
  );

  // ---- Queue 2 — Invoice & Collections list --------------------------------
  const listQuery = useQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, "list", statusValue, page],
    queryFn: () => fetchCommercialInvoices(statusValue, PAGE_SIZE, (page - 1) * PAGE_SIZE),
  });

  const rows = useMemo(() => {
    let list = listQuery.data?.items ?? [];
    if (overdueOnly) list = list.filter(inv => daysOverdue(inv.dueDate) > 0 && parseFloat(inv.balanceDue || "0") > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        String(inv.executionId ?? "").includes(q) ||
        String(inv.id).includes(q),
      );
    }
    return list;
  }, [listQuery.data, overdueOnly, search]);

  const detailQuery = useQuery({
    queryKey: [...COMMERCIAL_BILLING_QUERY_KEY, "detail", drawerInvoiceId],
    queryFn: () => fetchCommercialInvoiceDetail(drawerInvoiceId!),
    enabled: drawerInvoiceId != null,
  });

  // ---- Mutations ------------------------------------------------------------
  const previewMut = useMutation({
    mutationFn: (jobId: number) => previewJobInvoice(jobId),
    onSuccess: (data) => setPreview(data),
    onError: (err: Error) => toast({ title: "Preview failed", description: err.message, variant: "destructive" }),
  });

  const generateMut = useMutation({
    mutationFn: (jobId: number) => generateJobInvoice(jobId),
    onMutate: (jobId) => setBusyJobId(jobId),
    onSettled: () => setBusyJobId(null),
    onSuccess: (inv) => {
      toast({ title: "Draft invoice created", description: inv.invoiceNumber });
      invalidate();
      setDrawerInvoiceId(inv.id);
    },
    onError: (err: Error) => toast({ title: "Generate failed", description: err.message, variant: "destructive" }),
  });

  const issueMut = useMutation({
    mutationFn: (id: number) => issueCommercialInvoice(id),
    onSuccess: (inv) => {
      toast({ title: "Invoice issued", description: inv.invoiceNumber });
      invalidate();
      void detailQuery.refetch();
    },
    onError: (err: Error) => toast({ title: "Issue failed", description: err.message, variant: "destructive" }),
  });

  const paidMut = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount?: number }) =>
      markCommercialInvoicePaid(id, amount ? { amount } : undefined),
    onSuccess: (inv) => {
      toast({ title: "Marked paid", description: `${inv.invoiceNumber} commercially closed` });
      invalidate();
      void detailQuery.refetch();
      setMarkPaidTarget(null);
      setMarkPaidAmount("");
    },
    onError: (err: Error) => toast({ title: "Mark paid failed", description: err.message, variant: "destructive" }),
  });

  const voidMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => voidCommercialInvoice(id, reason),
    onSuccess: (inv) => {
      toast({ title: "Invoice voided", description: inv.invoiceNumber });
      setVoidTarget(null);
      setVoidReason("");
      invalidate();
      void detailQuery.refetch();
    },
    onError: (err: Error) => toast({ title: "Void failed", description: err.message, variant: "destructive" }),
  });

  const canIssue = (inv: CommercialInvoice) => inv.commercialStatus === "draft";
  const canMarkPaid = (inv: CommercialInvoice) =>
    inv.commercialStatus === "payment_pending" || inv.commercialStatus === "issued";
  const canVoid = (inv: CommercialInvoice) =>
    inv.commercialStatus !== "voided" && inv.commercialStatus !== "commercially_closed";

  const selectedInvoices = useMemo(
    () => rows.filter(inv => selectedKeys.includes(inv.id)),
    [rows, selectedKeys],
  );

  const runBulk = async (
    mutate: (inv: CommercialInvoice) => Promise<CommercialInvoice>,
    predicate: (inv: CommercialInvoice) => boolean,
    verb: string,
  ) => {
    const eligible = selectedInvoices.filter(predicate);
    const skipped = selectedInvoices.length - eligible.length;
    if (eligible.length === 0) {
      toast({ title: "No eligible invoices", description: `None of the selected invoices can be ${verb} right now.`, variant: "destructive" });
      return;
    }
    await Promise.allSettled(eligible.map(mutate));
    invalidate();
    toast({
      title: `${eligible.length} invoice(s) ${verb}`,
      description: skipped > 0 ? `${skipped} invoice(s) skipped — not eligible.` : undefined,
    });
    setSelectedKeys([]);
  };

  // ---- CSV export (client-side only — mirrors Job Orchestration's Export pattern) ----
  const exportCsv = (list: CommercialInvoice[], filenameSuffix: string) => {
    const header = ["Invoice No.", "Customer ID", "Job/Execution", "Billing Mode", "Status", "Total", "Balance Due", "Due Date"];
    const lines = list.map(inv => [
      inv.invoiceNumber, inv.customerId, inv.executionId ?? "—", billingModeLabel(inv.billingMode),
      commercialStatusLabel(inv.commercialStatus), inv.totalAmount, inv.balanceDue, inv.dueDate ?? "—",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commercial-invoices-${filenameSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = search !== "" || statusValue !== "all" || overdueOnly;
  const clearFilters = () => { setSearch(""); setStatusValue("all"); setOverdueOnly(false); setPage(1); };

  const scrollToReady = () => queue1Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ---- KPI row (Collection Insights) ---------------------------------------
  const kpis: KpiItem[] = [
    {
      id: "ready-for-billing", label: "Ready for Billing", value: readyQuery.data?.total ?? 0, icon: Receipt,
      tone: (readyQuery.data?.total ?? 0) > 0 ? "success" : "default",
      prominent: (readyQuery.data?.total ?? 0) > 0,
      onClick: scrollToReady,
    },
    {
      id: "draft", label: "Draft", value: draftAggQuery.data?.total ?? 0, icon: FilePlus2,
      onClick: () => { setStatusValue("draft"); setOverdueOnly(false); setPage(1); },
    },
    {
      id: "outstanding", label: "Outstanding", value: outstandingAggQuery.data?.total ?? 0, icon: Clock,
      tone: (outstandingAggQuery.data?.total ?? 0) > 0 ? "warning" : "default",
      subtitle: formatMoney(pendingCollectionTotal),
      onClick: () => { setStatusValue("outstanding"); setOverdueOnly(false); setPage(1); },
    },
    {
      id: "overdue", label: "Overdue", value: overdueItems.length, icon: AlertTriangle,
      tone: overdueItems.length > 0 ? "destructive" : "default",
      onClick: () => { setStatusValue("outstanding"); setOverdueOnly(true); setPage(1); },
    },
    {
      id: "paid", label: "Paid / Closed", value: closedAggQuery.data?.total ?? 0, icon: CheckCircle2,
      tone: "success",
      onClick: () => { setStatusValue("commercially_closed"); setOverdueOnly(false); setPage(1); },
    },
    {
      id: "collected-today", label: "Collected Today", value: formatMoney(collectedTodayTotal), icon: IndianRupee,
      tone: "success",
    },
  ];

  const aggLoading = draftAggQuery.isLoading || outstandingAggQuery.isLoading || closedAggQuery.isLoading || readyQuery.isLoading;

  const invoice = detailQuery.data?.invoice;
  const timeline = detailQuery.data?.timeline ?? [];
  const businessTimeline: TimelineEvent[] = timeline
    .filter(t => COMMERCIAL_BUSINESS_EVENTS.has(t.eventType))
    .map(t => ({
      id: t.id, title: t.title, description: t.description ?? undefined,
      actor: t.actorName ?? undefined, timestamp: formatDate(t.createdAt),
      icon: TIMELINE_ICON[t.eventType], tone: timelineTone(t),
    }));
  const activityItems: ActivityItem[] = timeline
    .filter(t => !COMMERCIAL_BUSINESS_EVENTS.has(t.eventType))
    .map(t => ({
      id: t.id, icon: TIMELINE_ICON[t.eventType] ?? History,
      title: t.title,
      subtitle: [t.description, t.actorName ? `by ${t.actorName}` : null].filter(Boolean).join(" — ") || undefined,
      timestamp: formatDate(t.createdAt),
    }));

  const drawerActions: ActionBarAction[] = invoice ? [
    ...(canIssue(invoice) ? [{ id: "issue", label: "Issue Invoice", icon: <Receipt size={14} />, onClick: () => issueMut.mutate(invoice.id), disabled: issueMut.isPending }] : []),
    ...(canMarkPaid(invoice) ? [{ id: "mark-paid", label: "Mark Paid & Close", icon: <CheckCircle2 size={14} />, onClick: () => setMarkPaidTarget(invoice), disabled: paidMut.isPending }] : []),
    ...(parseFloat(invoice.balanceDue || "0") > 0 ? [{ id: "credit-note", label: "Refund Note", icon: <FileText size={14} />, variant: "secondary" as const, onClick: () => setCreditNoteTarget(invoice) }] : []),
    ...(canVoid(invoice) ? [{ id: "void", label: "Void", icon: <Ban size={14} />, variant: "destructive" as const, onClick: () => setVoidTarget(invoice) }] : []),
  ] : [];

  // ---- Queue 1 columns --------------------------------------------------
  const readyColumns: Column<ReadyForBillingRow>[] = [
    { key: "jobId", header: "Job", cell: r => <span className="font-medium text-foreground">#{r.jobId}</span> },
    {
      key: "customer", header: "Customer",
      cell: r => <span>{r.customerName ?? `Customer #${r.customerId}`}</span>,
    },
    {
      key: "source", header: "Source / Product", hideable: true,
      cell: r => (
        <div>
          <p className="capitalize">{r.productLine?.replace(/_/g, " ") ?? "—"}</p>
          <p className="text-xs text-muted-foreground capitalize">{r.sourceSystem?.replace(/_/g, " ") ?? "—"}</p>
        </div>
      ),
    },
    { key: "scheduled", header: "Scheduled", hideable: true, cell: r => <span className="text-xs text-muted-foreground">{r.scheduledDate}</span> },
    { key: "ready", header: "Ready Since", sortable: false, hideable: true, cell: r => <span className="text-xs text-muted-foreground">{formatDate(r.readyForBillingAt)}</span> },
    {
      key: "actions", header: "", align: "right", hideable: false, sticky: "right",
      cell: r => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm" variant="outline" className="h-7 px-2 text-xs"
            disabled={busyJobId === r.jobId || !!r.invoiceId}
            onClick={() => previewMut.mutate(r.jobId)}
          >
            Preview
          </Button>
          <Button
            size="sm" className="h-7 px-2 text-xs"
            disabled={busyJobId === r.jobId || !!r.invoiceId}
            onClick={() => generateMut.mutate(r.jobId)}
          >
            {busyJobId === r.jobId ? <Loader2 size={12} className="animate-spin" /> : "Generate Invoice"}
          </Button>
        </div>
      ),
    },
  ];

  // ---- Queue 2 columns ----------------------------------------------------
  const columns: Column<CommercialInvoice>[] = [
    {
      key: "invoiceNumber", header: "Invoice No.",
      cell: inv => (
        <div>
          <p className="font-mono text-xs font-medium text-foreground">{inv.invoiceNumber}</p>
          <p className="text-xs text-muted-foreground">{billingModeLabel(inv.billingMode)}</p>
        </div>
      ),
    },
    { key: "customer", header: "Customer", cell: inv => <CustomerCell customerId={inv.customerId} /> },
    {
      key: "job", header: "Related Job", hideable: true,
      cell: inv => inv.executionId != null
        ? <span className="text-xs">Job #{inv.executionId}</span>
        : <span className="text-xs text-muted-foreground">Manual</span>,
    },
    { key: "status", header: "Invoice Status", cell: inv => <StatusBadge status={inv.commercialStatus} label={commercialStatusLabel(inv.commercialStatus)} /> },
    { key: "progress", header: "Payment Progress", hideable: true, cell: inv => <PaymentProgress status={inv.commercialStatus} /> },
    { key: "amount", header: "Amount", align: "right", cell: inv => <span className="font-medium">{formatMoney(inv.totalAmount)}</span> },
    {
      key: "balance", header: "Outstanding", align: "right",
      cell: inv => parseFloat(inv.balanceDue || "0") > 0
        ? <span className="text-destructive font-medium">{formatMoney(inv.balanceDue)}</span>
        : <span className="text-green-600">{formatMoney(inv.balanceDue)}</span>,
    },
    {
      key: "due", header: "Due Date", hideable: true,
      cell: inv => {
        const overdue = daysOverdue(inv.dueDate) > 0 && parseFloat(inv.balanceDue || "0") > 0;
        return (
          <div>
            <p className="text-xs">{formatDateShort(inv.dueDate)}</p>
            {overdue && <p className="text-xs text-destructive">{daysOverdue(inv.dueDate)}d overdue</p>}
          </div>
        );
      },
    },
    {
      key: "actions", header: "", align: "right", hideable: false, sticky: "right",
      cell: inv => (
        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
          {canIssue(inv) && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={issueMut.isPending} onClick={() => issueMut.mutate(inv.id)}>
              Issue
            </Button>
          )}
          {canMarkPaid(inv) && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setMarkPaidTarget(inv)}>
              Mark Paid
            </Button>
          )}
          <InvoicePdfButton invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} className="text-xs text-muted-foreground hover:text-primary h-7 px-1.5 flex items-center gap-1">
            <FileText size={12} />
          </InvoicePdfButton>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDrawerInvoiceId(inv.id)}>
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <KpiRow items={kpis} isLoading={aggLoading} columns={6} />

      <FilterBar
        search={search}
        onSearchChange={v => { setSearch(v); }}
        searchPlaceholder="Search invoice no., job / execution id…"
        statusOptions={STATUS_OPTIONS}
        statusValue={statusValue}
        onStatusChange={v => { setStatusValue(v as InvoiceCommercialStatus | "outstanding" | "all"); setPage(1); }}
        quickFilters={[
          { id: "outstanding", label: "Outstanding", active: statusValue === "outstanding" && !overdueOnly, onClick: () => { setStatusValue("outstanding"); setOverdueOnly(false); setPage(1); } },
          { id: "overdue", label: "Overdue", active: overdueOnly, onClick: () => { setStatusValue("outstanding"); setOverdueOnly(!overdueOnly); setPage(1); } },
        ]}
        onClearAll={hasActiveFilters ? clearFilters : undefined}
      >
        <Button variant="outline" size="sm" onClick={() => exportCsv(rows, "current-view")} data-testid="commercial-export-view">
          <Download size={14} className="mr-1.5" /> Export View
        </Button>
      </FilterBar>

      {/* Queue 1 — Ready for Billing (operational handoff, highest visibility) */}
      <div ref={queue1Ref} className="rounded-xl border-2 border-primary/20 bg-primary/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Receipt size={15} className="text-primary" /> Ready for Billing</h3>
            <p className="text-xs text-muted-foreground">Jobs completed and ready for the operational handoff into billing.</p>
          </div>
        </div>
        <DataTable
          columns={readyColumns}
          rows={readyQuery.data?.items}
          isLoading={readyQuery.isLoading}
          error={readyQuery.isError ? true : undefined}
          onRetry={() => readyQuery.refetch()}
          rowKey={r => r.jobId}
          emptyTitle="No jobs ready for billing"
          emptyDescription="Jobs appear here once field execution and quality review are complete."
        />
      </div>

      {/* Commercial Handoff — visualizes the Operations → Billing → Collections pipeline */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Commercial Handoff</p>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {[
            { label: "Ready for Billing", value: readyQuery.data?.total ?? 0 },
            { label: "Invoices Generated", value: draftAggQuery.data?.total ?? 0 },
            { label: "Pending Collection", value: formatMoney(pendingCollectionTotal) },
            { label: "Collected Today", value: formatMoney(collectedTodayTotal) },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 sm:gap-4">
              <div className="min-w-[100px]">
                <p className="text-lg font-display font-bold tabular-nums">{step.value}</p>
                <p className="text-xs text-muted-foreground">{step.label}</p>
              </div>
              {i < arr.length - 1 && <ArrowRight size={16} className="text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Queue 2 — Invoice & Collections */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Invoice & Collections</h3>
        <DataTable
          columns={columns}
          rows={rows}
          isLoading={listQuery.isLoading}
          error={listQuery.isError ? true : undefined}
          onRetry={() => listQuery.refetch()}
          rowKey={inv => inv.id}
          onRowClick={inv => setDrawerInvoiceId(inv.id)}
          rowLabel={inv => `View invoice ${inv.invoiceNumber}`}
          caption="Invoice and collections queue — draft, issued, outstanding, paid and closed invoices"
          emptyTitle={hasActiveFilters ? "No invoices match your filters" : "No invoices yet"}
          emptyDescription={hasActiveFilters ? "Try a different search or filter, or clear filters." : "Invoices appear here once generated from the Ready for Billing queue or created manually."}
          emptyAction={hasActiveFilters ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
          selection={{ selectedKeys, onSelectionChange: setSelectedKeys }}
          enableColumnVisibility
          pagination={{ page, pageSize: PAGE_SIZE, total: listQuery.data?.total ?? 0, onPageChange: setPage }}
        />

        <BulkActionBar
          selectedCount={selectedKeys.length}
          onClear={() => setSelectedKeys([])}
          actions={[
            { id: "issue", label: "Issue Invoice", icon: <Receipt size={14} />, onClick: () => setBulkIssueConfirm(true) },
            { id: "mark-paid", label: "Mark Paid", icon: <CheckCircle2 size={14} />, onClick: () => setBulkMarkPaidConfirm(true) },
            { id: "export", label: "Export Selected", icon: <Download size={14} />, onClick: () => exportCsv(selectedInvoices, "selected") },
          ]}
        />
      </div>

      {/* Preview dialog (Queue 1) */}
      <ConfirmDialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview ? `Invoice preview · Job #${preview.jobId}` : "Invoice preview"}
        confirmLabel={preview?.existingInvoiceId ? "Close" : "Generate draft"}
        onConfirm={() => {
          if (preview && !preview.existingInvoiceId) generateMut.mutate(preview.jobId);
          setPreview(null);
        }}
        description={preview && (
          <div className="space-y-3 text-sm text-left">
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{preview.customerName ?? preview.customerId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{billingModeLabel(preview.billingMode)} · {preview.pricingSource}</span></div>
            <ul className="space-y-1 border rounded-md p-3 max-h-40 overflow-y-auto">
              {preview.lines.map((line, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{line.description}{line.isComplimentary ? " (complimentary)" : ""}</span>
                  <span>{formatMoney(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-medium"><span>Total</span><span>{formatMoney(preview.totalAmount)}</span></div>
            {preview.existingInvoiceNumber && (
              <p className="text-muted-foreground">Links prepaid invoice {preview.existingInvoiceNumber} — no second charge will be created.</p>
            )}
          </div>
        )}
      />

      {/* Invoice detail drawer */}
      <EntityDrawer
        open={drawerInvoiceId != null}
        onOpenChange={(open) => { if (!open) setDrawerInvoiceId(null); }}
        title={invoice?.invoiceNumber ?? "Invoice"}
        description={invoice?.executionId != null ? `Job #${invoice.executionId}` : "Manual invoice"}
        status={invoice?.commercialStatus ?? undefined}
        tabs={invoice ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={invoice.commercialStatus} label={commercialStatusLabel(invoice.commercialStatus)} />
                  <StatusBadge status={invoice.billingMode ?? "manual"} label={billingModeLabel(invoice.billingMode)} tone="neutral" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground">Customer</p><p className="font-medium"><CustomerCell customerId={invoice.customerId} /></p></div>
                  <div><p className="text-muted-foreground">Total</p><p className="font-medium">{formatMoney(invoice.totalAmount)}</p></div>
                  <div><p className="text-muted-foreground">Balance Due</p><p className="font-medium">{formatMoney(invoice.balanceDue)}</p></div>
                  <div><p className="text-muted-foreground">Due Date</p><p className="font-medium">{formatDateShort(invoice.dueDate)}</p></div>
                  <div><p className="text-muted-foreground">Issued</p><p className="font-medium">{formatDate(invoice.issuedAt)}</p></div>
                  <div><p className="text-muted-foreground">Closed</p><p className="font-medium">{formatDate(invoice.commerciallyClosedAt)}</p></div>
                </div>
                {invoice.voidReason && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <p className="font-medium text-destructive flex items-center gap-1.5"><Ban size={14} /> Voided</p>
                    <p className="text-muted-foreground mt-1">{invoice.voidReason}</p>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "invoice",
            label: "Invoice",
            content: (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(invoice.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{formatMoney(invoice.discount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{formatMoney(invoice.gstAmount)}</span></div>
                <div className="flex justify-between font-medium border-t border-border pt-2"><span>Total</span><span>{formatMoney(invoice.totalAmount)}</span></div>
                <a
                  href={invoicePdfUrl(invoice.id)}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
                >
                  <FileText size={14} /> View full invoice PDF
                </a>
              </div>
            ),
          },
          {
            id: "payment",
            label: "Payment Timeline",
            content: (
              <div className="space-y-4 text-sm">
                <PaymentProgress status={invoice.commercialStatus} />
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground">Paid</p><p className="font-medium">{formatDate(invoice.paidAt)}</p></div>
                  <div><p className="text-muted-foreground">Balance Due</p><p className="font-medium">{formatMoney(invoice.balanceDue)}</p></div>
                </div>
              </div>
            ),
          },
          {
            id: "commercial-timeline",
            label: "Commercial Timeline",
            content: detailQuery.isLoading
              ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
              : <Timeline events={businessTimeline} emptyMessage="No commercial timeline events yet." />,
          },
          {
            id: "activity",
            label: "Activity",
            content: detailQuery.isLoading
              ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
              : <ActivityFeed items={activityItems} emptyMessage="No additional activity yet." />,
          },
          {
            id: "actions",
            label: "Actions",
            content: (
              <div className="space-y-3">
                <ActionBar actions={drawerActions} />
                {drawerActions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No actions available — invoice is voided or commercially closed.</p>
                )}
              </div>
            ),
          },
        ] : undefined}
      />

      {/* Void confirmation */}
      <ConfirmDialog
        open={!!voidTarget}
        onOpenChange={(open) => { if (!open) { setVoidTarget(null); setVoidReason(""); } }}
        title={`Void invoice ${voidTarget?.invoiceNumber}?`}
        description={
          <div className="space-y-2">
            <p>Provide a reason. Commercially closed invoices cannot be voided — use a refund note instead.</p>
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoFocus />
          </div>
        }
        confirmLabel="Void invoice"
        destructive
        onConfirm={() => voidTarget && voidMut.mutate({ id: voidTarget.id, reason: voidReason })}
        isConfirming={voidMut.isPending}
      />

      {/* Mark paid confirmation */}
      <ConfirmDialog
        open={!!markPaidTarget}
        onOpenChange={(open) => { if (!open) { setMarkPaidTarget(null); setMarkPaidAmount(""); } }}
        title={`Mark ${markPaidTarget?.invoiceNumber} as paid?`}
        description={
          <div className="space-y-2">
            <p>Records the payment and closes the invoice commercially. Leave blank to record the full balance due ({formatMoney(markPaidTarget?.balanceDue)}).</p>
            <Label htmlFor="mark-paid-amount">Amount received (₹, optional)</Label>
            <Input id="mark-paid-amount" type="number" min={0} value={markPaidAmount} onChange={(e) => setMarkPaidAmount(e.target.value)} placeholder={markPaidTarget?.balanceDue} />
          </div>
        }
        confirmLabel="Mark paid & close"
        onConfirm={() => markPaidTarget && paidMut.mutate({ id: markPaidTarget.id, amount: markPaidAmount ? parseFloat(markPaidAmount) : undefined })}
        isConfirming={paidMut.isPending}
      />

      {/* Bulk issue confirmation */}
      <ConfirmDialog
        open={bulkIssueConfirm}
        onOpenChange={setBulkIssueConfirm}
        title={`Issue ${selectedInvoices.filter(canIssue).length} of ${selectedInvoices.length} selected invoice(s)?`}
        description="Only draft invoices will be issued. Others will be skipped."
        confirmLabel="Issue eligible invoices"
        onConfirm={async () => { await runBulk((inv) => issueCommercialInvoice(inv.id), canIssue, "issued"); setBulkIssueConfirm(false); }}
        isConfirming={issueMut.isPending}
      />

      {/* Bulk mark-paid confirmation */}
      <ConfirmDialog
        open={bulkMarkPaidConfirm}
        onOpenChange={setBulkMarkPaidConfirm}
        title={`Mark ${selectedInvoices.filter(canMarkPaid).length} of ${selectedInvoices.length} selected invoice(s) paid?`}
        description="Only issued/outstanding invoices will be marked fully paid and commercially closed. Others will be skipped."
        confirmLabel="Mark paid & close eligible"
        onConfirm={async () => { await runBulk((inv) => markCommercialInvoicePaid(inv.id), canMarkPaid, "marked paid"); setBulkMarkPaidConfirm(false); }}
        isConfirming={paidMut.isPending}
      />

      {creditNoteTarget && (
        <CreateCreditNoteDialog
          open={!!creditNoteTarget}
          onOpenChange={(open) => !open && setCreditNoteTarget(null)}
          invoice={{
            id: creditNoteTarget.id,
            invoiceNumber: creditNoteTarget.invoiceNumber,
            balanceDue: creditNoteTarget.balanceDue,
            totalAmount: creditNoteTarget.totalAmount,
          }}
          onCreated={() => { invalidate(); setCreditNoteTarget(null); }}
        />
      )}
    </div>
  );
}

export default CommercialOperationsCenter;
