import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageTemplate } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  Receipt,
  FileText,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  RotateCcw,
  Scale,
  Sparkles,
  BarChart3,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  TransactionDetailsDrawer,
  type LedgerRowData,
} from "./TransactionDetailsDrawer";

interface LedgerSummaryData {
  todayCollected: number;
  todayTransactionsCount: number;
  thisMonthCollected: number;
  pendingTransactionsCount: number;
  failedTransactionsCount: number;
  totalCollectedAllTime: number;
  totalOutstandingCustomerDues: number;
  calculatedAtIst: string;
}

interface LedgerResponse {
  data: LedgerRowData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PaymentLedgerPage() {
  const qc = useQueryClient();

  // Active Hub View
  const [activeTab, setActiveTab] = useState<"ledger" | "reconciliation" | "revenue" | "refunds">("ledger");

  // Auto-refresh configuration (in ms, default 30000)
  const [refreshInterval, setRefreshInterval] = useState<number>(30000);

  // Filter States for Ledger
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refundStatus, setRefundStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [city, setCity] = useState("all");
  const [branch, setBranch] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  // Drawer & Selection
  const [selectedTx, setSelectedTx] = useState<LedgerRowData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reconciliation modal state
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [targetReconcileOrderId, setTargetReconcileOrderId] = useState("");
  const [reconcileReason, setReconcileReason] = useState("");
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Handle Date Presets
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();
    const formatYmd = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = formatYmd(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatYmd(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "this_week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      setStartDate(formatYmd(startOfWeek));
      setEndDate(formatYmd(now));
    } else if (preset === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYmd(startOfMonth));
      setEndDate(formatYmd(now));
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("all");
    setRefundStatus("all");
    setMethod("all");
    setCity("all");
    setBranch("all");
    setServiceType("all");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Build query string for ledger list
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(limit));
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (status !== "all") p.set("status", status);
    if (refundStatus !== "all") p.set("refundStatus", refundStatus);
    if (method !== "all") p.set("method", method);
    if (city !== "all") p.set("city", city);
    if (branch !== "all") p.set("branchId", branch);
    if (serviceType !== "all") p.set("serviceType", serviceType);
    if (startDate) p.set("startDate", startDate);
    if (endDate) p.set("endDate", endDate);
    return p.toString();
  }, [page, limit, debouncedSearch, status, refundStatus, method, city, branch, serviceType, startDate, endDate]);

  // Summary Metrics Query
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
  } = useQuery<LedgerSummaryData>({
    queryKey: ["admin", "payments", "ledger", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payments/ledger/summary", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load ledger summary");
      return res.json();
    },
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
    refetchIntervalInBackground: false,
  });

  // Ledger List Query
  const {
    data: ledgerData,
    isLoading: isLedgerLoading,
    refetch: refetchLedger,
    isFetching: isLedgerFetching,
    dataUpdatedAt,
  } = useQuery<LedgerResponse>({
    queryKey: ["admin", "payments", "ledger", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments/ledger?${queryParams}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load payment ledger");
      return res.json();
    },
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
    refetchIntervalInBackground: false,
    enabled: activeTab === "ledger",
  });

  // Branches Query for branch filter
  const { data: branchesList } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["admin", "branches", "active-list"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data ?? [];
    },
  });

  // Reconciliation Hub Query
  const {
    data: reconciliationData,
    isLoading: isReconciliationLoading,
    refetch: refetchReconciliation,
  } = useQuery<{
    items: any[];
    summary: any;
  }>({
    queryKey: ["admin", "payments", "reconciliation", startDate, endDate, city],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      if (city !== "all") p.set("city", city);
      const res = await fetch(`/api/admin/payments/reconciliation/dashboard?${p.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load reconciliation");
      return res.json();
    },
    enabled: activeTab === "reconciliation",
  });

  // Revenue Intelligence Query
  const {
    data: revenueData,
    isLoading: isRevenueLoading,
    refetch: refetchRevenue,
  } = useQuery<any>({
    queryKey: ["admin", "payments", "revenue-intelligence", startDate, endDate, city],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      if (city !== "all") p.set("city", city);
      const res = await fetch(`/api/admin/payments/revenue-intelligence?${p.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load revenue intelligence");
      return res.json();
    },
    enabled: activeTab === "revenue",
  });

  // Refunds Register Query
  const {
    data: refundsData,
    isLoading: isRefundsLoading,
    refetch: refetchRefunds,
  } = useQuery<any>({
    queryKey: ["admin", "payments", "refunds-register"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payments/refunds", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load refunds");
      return res.json();
    },
    enabled: activeTab === "refunds",
  });

  // Reconcile Mutation
  const reconcileMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const res = await fetch(`/api/admin/payments/reconciliation/reconcile-order/${encodeURIComponent(orderId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reconciliation failed");
      return data;
    },
    onSuccess: () => {
      setReconcileModalOpen(false);
      setTargetReconcileOrderId("");
      setReconcileReason("");
      setReconcileError(null);
      refetchReconciliation();
      refetchSummary();
      refetchLedger();
    },
    onError: (err: any) => {
      setReconcileError(err.message || "Manual reconciliation failed");
    },
  });

  const isRefreshing = isSummaryFetching || isLedgerFetching;

  const handleManualRefresh = () => {
    refetchSummary();
    if (activeTab === "ledger") refetchLedger();
    if (activeTab === "reconciliation") refetchReconciliation();
    if (activeTab === "revenue") refetchRevenue();
    if (activeTab === "refunds") refetchRefunds();
  };

  const handleExportCsv = () => {
    const exportParams = new URLSearchParams();
    if (debouncedSearch.trim()) exportParams.set("search", debouncedSearch.trim());
    if (status !== "all") exportParams.set("status", status);
    if (refundStatus !== "all") exportParams.set("refundStatus", refundStatus);
    if (method !== "all") exportParams.set("method", method);
    if (city !== "all") exportParams.set("city", city);
    if (serviceType !== "all") exportParams.set("serviceType", serviceType);
    if (startDate) exportParams.set("startDate", startDate);
    if (endDate) exportParams.set("endDate", endDate);

    window.open(`/api/admin/payments/ledger/export?${exportParams.toString()}`, "_blank");
  };

  const handleCopyMonospace = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const formatLastUpdated = (timestamp: number) => {
    if (!timestamp) return "Never";
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const renderStatusBadge = (txStatus: LedgerRowData["status"]) => {
    switch (txStatus) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-600" />
            Paid
          </span>
        );
      case "partially_refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <RotateCcw size={11} className="text-amber-600" />
            Partially Refunded
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw size={11} className="text-purple-600" />
            Refunded
          </span>
        );
      case "requires_reconciliation":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Scale size={11} className="text-rose-600" />
            Needs Audit
          </span>
        );
      case "pending":
      case "initiated":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} className="text-amber-600" />
            {txStatus === "initiated" ? "Initiated" : "Pending"}
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={11} className="text-rose-600" />
            Failed
          </span>
        );
      case "cancelled":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Cancelled
          </span>
        );
    }
  };

  return (
    <PageTemplate
      title="Financial Command Center &amp; Payment Ledger"
      description="Cashfree payment tracking, transaction ledger, multi-gateway reconciliation, and revenue intelligence."
      breadcrumbs={[{ label: "Commercial" }, { label: "Financial Command Center" }]}
      secondaryActions={
        <div className="flex items-center gap-2">
          {/* Refresh Interval Selector */}
          <div className="flex items-center gap-1.5 bg-muted/50 border border-border px-2 py-1 rounded-md text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Auto-refresh:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent font-medium text-foreground cursor-pointer focus:outline-none"
            >
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
              <option value={0}>Off</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            data-testid="btn-ledger-refresh"
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-primary" : ""} />
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExportCsv}
            data-testid="btn-ledger-export"
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </Button>
        </div>
      }
    >
      {/* 1. TOP DASHBOARD SUMMARY CARDS (7 Primary Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Today Collected</span>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className="text-lg font-bold font-display text-emerald-600">
              ₹{(summary?.todayCollected ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {summary?.todayTransactionsCount ?? 0} settlements today
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>This Month</span>
            <Calendar size={14} className="text-primary" />
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className="text-lg font-bold font-display text-foreground">
              ₹{(summary?.thisMonthCollected ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">Current month receipts</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Pending Gateway</span>
            <Clock size={14} className="text-amber-500" />
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <p className="text-lg font-bold font-display text-amber-600">
              {summary?.pendingTransactionsCount ?? 0}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">In-flight checkouts</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Failed / Dropped</span>
            <XCircle size={14} className="text-rose-500" />
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <p className="text-lg font-bold font-display text-rose-600">
              {summary?.failedTransactionsCount ?? 0}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">Failed attempts</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>All-Time Collected</span>
            <Receipt size={14} className="text-primary" />
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className="text-lg font-bold font-display text-foreground">
              ₹{(summary?.totalCollectedAllTime ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">Total settled ledger</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Outstanding Dues</span>
            <AlertCircle size={14} className="text-amber-500" />
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className="text-lg font-bold font-display text-amber-600">
              ₹{(summary?.totalOutstandingCustomerDues ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">Active tax invoices</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>System Status</span>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Gateway Live
          </p>
          <p className="text-[10px] text-muted-foreground truncate" title={summary?.calculatedAtIst}>
            Refreshed: {formatLastUpdated(dataUpdatedAt)}
          </p>
        </div>
      </div>

      {/* 2. PILLAR NAVIGATION TABS */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "ledger"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-payment-ledger"
        >
          <Receipt size={14} />
          <span>Payment Ledger</span>
          <Badge variant="outline" className="text-[10px] ml-1">{ledgerData?.total ?? "..."}</Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reconciliation")}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "reconciliation"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-reconciliation-hub"
        >
          <Scale size={14} />
          <span>Payment Reconciliation Hub</span>
          {reconciliationData?.summary?.unmatchedCount ? (
            <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] ml-1">
              {reconciliationData.summary.unmatchedCount}
            </Badge>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("revenue")}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "revenue"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-revenue-intelligence"
        >
          <BarChart3 size={14} />
          <span>Revenue Intelligence</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("refunds")}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 ${
            activeTab === "refunds"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-refunds-register"
        >
          <RotateCcw size={14} />
          <span>Refund Register</span>
        </button>
      </div>

      {/* ─── TAB 1: TRANSACTION LEDGER ─── */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          {/* COMPOSABLE FILTER TOOLBAR */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={13} /> Filters &amp; Search
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-7"
              >
                Clear all filters
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Search Field */}
              <div className="relative lg:col-span-2">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search customer, phone, order ID, booking ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-xs h-9 bg-background"
                  data-testid="input-ledger-search"
                />
              </div>

              {/* Status Filter */}
              <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_refunded">Partially Refunded</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="requires_reconciliation">Needs Audit</SelectItem>
                </SelectContent>
              </Select>

              {/* Refund Filter */}
              <Select value={refundStatus} onValueChange={(val) => { setRefundStatus(val); setPage(1); }}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="Refund Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Refunds</SelectItem>
                  <SelectItem value="none">No Refund</SelectItem>
                  <SelectItem value="partial">Partial Refund</SelectItem>
                  <SelectItem value="refunded">Fully Refunded</SelectItem>
                </SelectContent>
              </Select>

              {/* Method Filter */}
              <Select value={method} onValueChange={(val) => { setMethod(val); setPage(1); }}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cashfree">Cashfree PG</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cash">Cash / Offline</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                </SelectContent>
              </Select>

              {/* City Filter */}
              <Select value={city} onValueChange={(val) => { setCity(val); setPage(1); }}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="City Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  <SelectItem value="Varanasi">Varanasi</SelectItem>
                  <SelectItem value="Noida">Noida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Preset Filter */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t text-xs">
              <span className="text-muted-foreground font-medium">Date Range:</span>
              {["all", "today", "yesterday", "this_week", "this_month"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleDatePresetChange(preset)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    datePreset === preset
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {preset.replace("_", " ").toUpperCase()}
                </button>
              ))}

              <div className="flex items-center gap-1.5 ml-auto">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDatePreset("custom"); setPage(1); }}
                  className="h-7 text-xs w-32"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setDatePreset("custom"); setPage(1); }}
                  className="h-7 text-xs w-32"
                />
              </div>
            </div>
          </div>

          {/* DENSE 16-FIELD TRANSACTION TABLE */}
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left" data-testid="table-payment-ledger">
                <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Date &amp; Time (IST)</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Booking / Service</th>
                    <th className="py-3 px-3">City / Branch</th>
                    <th className="py-3 px-3 text-right">Invoice Total</th>
                    <th className="py-3 px-3 text-right">Paid Amount</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Gateway Order ID</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Refund</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLedgerLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={11} className="py-3.5 px-4">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : !ledgerData?.data || ledgerData.data.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-muted-foreground">
                        <Receipt size={32} className="mx-auto mb-2 text-muted-foreground/50" />
                        <p className="font-semibold text-sm">No payment records match your filters</p>
                        <p className="text-xs mt-1">Try broadening your search term or clearing date bounds.</p>
                      </td>
                    </tr>
                  ) : (
                    ledgerData.data.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedTx(tx);
                          setDrawerOpen(true);
                        }}
                      >
                        {/* 1. Date (IST) */}
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium text-foreground">
                          {tx.paymentDateIst}
                        </td>

                        {/* 2. Customer */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground truncate max-w-[130px]" title={tx.customerName}>
                            {tx.customerName}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">{tx.customerPhone}</div>
                        </td>

                        {/* 3. Booking / Service */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            {tx.bookingRef ? (
                              <span className="font-mono font-bold text-primary">{tx.bookingRef}</span>
                            ) : (
                              <span className="text-muted-foreground font-mono">#{tx.invoiceNumber || tx.internalReference}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[150px]" title={tx.serviceDescription}>
                            {tx.serviceDescription}
                          </div>
                        </td>

                        {/* 4. City / Branch */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-medium text-foreground">{tx.city}</span>
                          {tx.branchName && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                              {tx.branchName}
                            </div>
                          )}
                        </td>

                        {/* 5. Invoice Total */}
                        <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                          ₹{tx.paymentAmount.toFixed(2)}
                        </td>

                        {/* 6. Final Paid Amount */}
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 font-display">
                          ₹{tx.amountPaid.toFixed(2)}
                        </td>

                        {/* 7. Payment Method */}
                        <td className="py-3 px-3 whitespace-nowrap uppercase text-[11px] font-semibold text-muted-foreground">
                          {tx.paymentMethod === "razorpay" ? (
                            <span className="text-emerald-700">Razorpay</span>
                          ) : tx.paymentMethod === "cashfree" ? (
                            <span className="text-blue-700">Cashfree</span>
                          ) : (
                            tx.paymentMethod
                          )}
                        </td>

                        {/* 8. Gateway Order ID */}
                        <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {tx.cfOrderId ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[11px] text-foreground truncate max-w-[120px] select-all">
                                {tx.cfOrderId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyMonospace(tx.cfOrderId!, tx.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Copy Order ID"
                              >
                                {copiedId === tx.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* 9. Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderStatusBadge(tx.status)}
                        </td>

                        {/* 10. Refund Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {tx.refundStatus !== "none" ? (
                            <span className="font-semibold text-amber-700 text-[11px]">
                              {tx.refundStatus === "partial" ? "Partial" : "Refunded"} (₹{tx.refundedAmount.toFixed(0)})
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        {/* 11. Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-medium"
                            onClick={() => {
                              setSelectedTx(tx);
                              setDrawerOpen(true);
                            }}
                          >
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* SERVER-SIDE PAGINATION */}
            <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Showing {ledgerData?.data ? (page - 1) * limit + 1 : 0} to{" "}
                {ledgerData?.data ? Math.min(page * limit, ledgerData.total) : 0} of {ledgerData?.total ?? 0} entries
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="font-medium px-2">Page {page} of {ledgerData?.totalPages || 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(ledgerData?.totalPages || 1, p + 1))}
                  disabled={page >= (ledgerData?.totalPages || 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: PAYMENT RECONCILIATION HUB ─── */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6" data-testid="reconciliation-hub-container">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Reconciliation Health</span>
              <p className="text-2xl font-bold font-display text-emerald-600">
                {reconciliationData?.summary?.reconciliationHealthScore ?? 100}%
              </p>
              <p className="text-[11px] text-muted-foreground">Matched vs total transactions</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Matched Collections</span>
              <p className="text-2xl font-bold font-display text-foreground">
                ₹{(reconciliationData?.summary?.totalMatchedAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {reconciliationData?.summary?.matchedCount ?? 0} perfectly matched records
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Unreconciled / Mismatch</span>
              <p className="text-2xl font-bold font-display text-rose-600">
                {reconciliationData?.summary?.unmatchedCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Requires operational triage</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Missing Internal Credits</span>
              <p className="text-2xl font-bold font-display text-amber-600">
                {reconciliationData?.summary?.missingInternalCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Paid at gateway, uncredited in DB</p>
            </div>
          </div>

          {/* Exceptions Table */}
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Reconciliation Audit Exceptions</h3>
                <p className="text-xs text-muted-foreground">
                  Three-way cross check between internal payments, Cashfree gateway attempts, and invoices.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchReconciliation()}
                className="text-xs"
              >
                <RefreshCw size={12} className="mr-1.5" /> Re-scan
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Category</th>
                    <th className="py-3 px-3">Date (IST)</th>
                    <th className="py-3 px-3">Customer / Booking</th>
                    <th className="py-3 px-3">Gateway Order ID</th>
                    <th className="py-3 px-3 text-right">Internal Amount</th>
                    <th className="py-3 px-3 text-right">Gateway Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Recommended Action</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isReconciliationLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={9} className="py-3.5 px-4"><Skeleton className="h-5 w-full" /></td></tr>
                    ))
                  ) : !reconciliationData?.items || reconciliationData.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                        <p className="font-semibold text-sm">All Transactions 100% Reconciled</p>
                        <p className="text-xs mt-1">Zero discrepancies identified between Gateway and Billing Ledger.</p>
                      </td>
                    </tr>
                  ) : (
                    reconciliationData.items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono uppercase font-bold ${
                              item.category === "MATCHED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.severity === "critical"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {item.category.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-foreground">{item.transactionDateIst}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-foreground">{item.customerName}</p>
                          <p className="text-[11px] text-muted-foreground">{item.bookingRef || "No Booking"}</p>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-foreground select-all">{item.orderId || "—"}</td>
                        <td className="py-3 px-3 text-right font-medium text-foreground">
                          {item.internalAmount != null ? `₹${item.internalAmount.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-foreground">
                          {item.gatewayAmount != null ? `₹${item.gatewayAmount.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[11px] text-muted-foreground">
                            Int: {item.internalStatus || "None"} · GW: {item.gatewayStatus || "None"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground text-[11px] max-w-[200px] truncate" title={item.actionRequired}>
                          {item.actionRequired}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {item.canAutoReconcile && item.orderId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-primary border-primary/30"
                              onClick={() => {
                                setTargetReconcileOrderId(item.orderId);
                                setReconcileReason(`Manual reconciliation for order ${item.orderId}`);
                                setReconcileModalOpen(true);
                              }}
                            >
                              Reconcile
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: REVENUE INTELLIGENCE ─── */}
      {activeTab === "revenue" && (
        <div className="space-y-6" data-testid="revenue-intelligence-container">
          {/* Top Aggregate Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Gross Payment Volume (GPV)</span>
              <p className="text-2xl font-bold font-display text-foreground">
                ₹{(revenueData?.grossPaymentVolume ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground">All attempted transactions</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Net Collected Cash</span>
              <p className="text-2xl font-bold font-display text-emerald-600">
                ₹{(revenueData?.netCollectedAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground">Collected ₹ - Refunds ₹</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Payment Success Rate</span>
              <p className="text-2xl font-bold font-display text-primary">
                {revenueData?.transactionSuccessRate ?? 100}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {revenueData?.successfulTransactionsCount ?? 0} successful / {revenueData?.totalTransactionsCount ?? 0} total
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Average Transaction Value (ATV)</span>
              <p className="text-2xl font-bold font-display text-foreground">
                ₹{(revenueData?.averageTransactionValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground">Per completed checkout</p>
            </div>
          </div>

          {/* Breakdown Grid: City & Service */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* City Revenue Share */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" /> City-Wise Revenue Breakdown
              </h4>
              <div className="divide-y divide-border">
                {(revenueData?.cityBreakdown || []).map((c: any) => (
                  <div key={c.cityName} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{c.cityName}</p>
                      <p className="text-[11px] text-muted-foreground">{c.transactionsCount} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">₹{c.collectedAmount.toLocaleString("en-IN")}</p>
                      <p className="text-[11px] text-primary font-medium">{c.collectionSharePercent}% of total</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Category Breakdown */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-2xs space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-primary" /> Service Category Revenue
              </h4>
              <div className="divide-y divide-border">
                {(revenueData?.serviceBreakdown || []).map((s: any) => (
                  <div key={s.serviceType} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{s.serviceLabel}</p>
                      <p className="text-[11px] text-muted-foreground">{s.transactionsCount} orders</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">₹{s.collectedAmount.toLocaleString("en-IN")}</p>
                      <p className="text-[11px] text-primary font-medium">{s.sharePercent}% share</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Financial Policy Definitions Alert */}
          <div className="p-4 rounded-xl border border-border bg-muted/30 text-xs space-y-2">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-primary" /> Authoritative Financial Definitions &amp; Methodology
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Booking Value vs Collected: </span>
                Booking value represents schedule intent; revenue is only recognized upon cash capture and invoice settlement.
              </div>
              <div>
                <span className="font-semibold text-foreground">Gateway Settlement vs Cash: </span>
                Captured payments reflect customer debits; bank settlement reflects net payouts after payment gateway MDR fees.
              </div>
              <div>
                <span className="font-semibold text-foreground">Net Collected Formula: </span>
                Gross Collected Payments minus Authoritative Refunds. Non-refundable cancellations are treated per policy.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: REFUND REGISTER ─── */}
      {activeTab === "refunds" && (
        <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden" data-testid="refund-register-container">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Authoritative Refund Register</h3>
              <p className="text-xs text-muted-foreground">
                Chronological audit register of all full and partial refunds issued back to customer payment sources.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchRefunds()} className="text-xs">
              <RefreshCw size={12} className="mr-1.5" /> Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Refund ID</th>
                  <th className="py-3 px-3">Date (IST)</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3 text-right">Amount (INR)</th>
                  <th className="py-3 px-3">Gateway</th>
                  <th className="py-3 px-3">Gateway Ref</th>
                  <th className="py-3 px-3">Operational Reason</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isRefundsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={8} className="py-3.5 px-4"><Skeleton className="h-5 w-full" /></td></tr>
                  ))
                ) : !refundsData?.data || refundsData.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <RotateCcw size={32} className="mx-auto mb-2 text-muted-foreground/50" />
                      <p className="font-semibold text-sm">No Refunds Recorded</p>
                      <p className="text-xs mt-1">Zero customer refunds have been issued across the platform.</p>
                    </td>
                  </tr>
                ) : (
                  refundsData.data.map((ref: any) => (
                    <tr key={ref.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-foreground">{ref.refundId}</td>
                      <td className="py-3 px-3 text-foreground">{ref.createdAtIst}</td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-foreground">{ref.customerName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{ref.customerPhone}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600 font-display">
                        ₹{parseFloat(ref.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 uppercase text-[11px] font-semibold text-muted-foreground">
                        {ref.gatewayProvider}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-foreground select-all">
                        {ref.gatewayRefundId || ref.cfRefundId || "—"}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground max-w-[200px] truncate" title={ref.reason}>
                        {ref.reason}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-bold ${
                            ref.status === "succeeded"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : ref.status === "failed"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {ref.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL & REFUND DRAWER */}
      <TransactionDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        transaction={selectedTx}
        onTransactionUpdated={handleManualRefresh}
      />

      {/* MANUAL RECONCILIATION MODAL */}
      <Dialog open={reconcileModalOpen} onOpenChange={setReconcileModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Scale size={18} /> Perform Manual Gateway Reconciliation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Re-verify gateway settlement directly with Cashfree and atomically synchronize the internal billing ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Target Order ID</Label>
              <Input
                readOnly
                value={targetReconcileOrderId}
                className="font-mono text-xs bg-muted"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reason for Manual Correction (Mandatory Audit Log)</Label>
              <Textarea
                rows={3}
                value={reconcileReason}
                onChange={(e) => setReconcileReason(e.target.value)}
                placeholder="e.g. Gateway webhook delay confirmed, Bank statement reconciliation..."
                className="text-xs"
              />
            </div>

            {reconcileError && (
              <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{reconcileError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReconcileModalOpen(false)}
              disabled={reconcileMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => reconcileMutation.mutate({ orderId: targetReconcileOrderId, reason: reconcileReason })}
              disabled={reconcileMutation.isPending || !reconcileReason.trim()}
            >
              {reconcileMutation.isPending ? "Reconciling..." : "Confirm & Reconcile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTemplate>
  );
}
