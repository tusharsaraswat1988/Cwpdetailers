import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  // Filter States
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [city, setCity] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  // Drawer & Selection
  const [selectedTx, setSelectedTx] = useState<LedgerRowData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    // Use local/IST YYYY-MM-DD
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

  // Build query string for ledger list
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(limit));
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (status !== "all") p.set("status", status);
    if (method !== "all") p.set("method", method);
    if (city !== "all") p.set("city", city);
    if (startDate) p.set("startDate", startDate);
    if (endDate) p.set("endDate", endDate);
    return p.toString();
  }, [page, limit, debouncedSearch, status, method, city, startDate, endDate]);

  // Summary Metrics Query (Auto-refreshes every 30s)
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
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Ledger List Query (Auto-refreshes every 30s)
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
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const isRefreshing = isSummaryFetching || isLedgerFetching;

  const handleManualRefresh = () => {
    refetchSummary();
    refetchLedger();
  };

  const handleExportCsv = () => {
    const exportParams = new URLSearchParams();
    if (debouncedSearch.trim()) exportParams.set("search", debouncedSearch.trim());
    if (status !== "all") exportParams.set("status", status);
    if (method !== "all") exportParams.set("method", method);
    if (city !== "all") exportParams.set("city", city);
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
      case "success":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-600" />
            Success
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} className="text-amber-600" />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={11} className="text-rose-600" />
            Failed
          </span>
        );
      case "reversed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertCircle size={11} className="text-purple-600" />
            Reversed
          </span>
        );
      case "abandoned":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Abandoned
          </span>
        );
    }
  };

  return (
    <PageTemplate
      title="Payment Ledger"
      description="Real-time payment gateway settlements, financial transaction monitoring, and automated billing reconciliation."
      breadcrumbs={[{ label: "Commercial" }, { label: "Payment Ledger" }]}
      secondaryActions={
        <div className="flex items-center gap-2">
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
      {/* 1. TOP DASHBOARD SUMMARY CARDS (7 Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {/* Card 1: Today Collected */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Today Collected</span>
            <TrendingUp size={13} className="text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {isSummaryLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              `₹${summary?.todayCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "0.00"}`
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Settled today (IST)</p>
        </div>

        {/* Card 2: Today Transactions */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Today Txns</span>
            <CheckCircle2 size={13} className="text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {isSummaryLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              summary?.todayTransactionsCount ?? 0
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Successful transactions</p>
        </div>

        {/* Card 3: This Month Collected */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>This Month</span>
            <Receipt size={13} className="text-primary" />
          </div>
          <div className="text-lg font-bold text-primary font-display">
            {isSummaryLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              `₹${summary?.thisMonthCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "0.00"}`
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Current calendar month</p>
        </div>

        {/* Card 4: Pending Payments */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Pending</span>
            <Clock size={13} className="text-amber-500" />
          </div>
          <div className="text-lg font-bold text-amber-600">
            {isSummaryLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              summary?.pendingTransactionsCount ?? 0
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Active gateway sessions</p>
        </div>

        {/* Card 5: Failed Payments */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Failed</span>
            <XCircle size={13} className="text-rose-500" />
          </div>
          <div className="text-lg font-bold text-rose-600">
            {isSummaryLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              summary?.failedTransactionsCount ?? 0
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Declined or dropped</p>
        </div>

        {/* Card 6: Total Collected All Time */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Collected</span>
            <ShieldCheck size={13} className="text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {isSummaryLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              `₹${summary?.totalCollectedAllTime.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "0.00"}`
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">All completed collections</p>
        </div>

        {/* Card 7: Total Outstanding Dues */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Outstanding Dues</span>
            <AlertCircle size={13} className="text-amber-500" />
          </div>
          <div className="text-lg font-bold text-amber-600">
            {isSummaryLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              `₹${summary?.totalOutstandingCustomerDues.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "0.00"}`
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Unpaid active invoices</p>
        </div>
      </div>

      {/* 2. FILTER TOOLBAR & LIVE STATUS BAR */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Global Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone, invoice #, order ID, payment ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
              data-testid="input-ledger-search"
            />
          </div>

          {/* Quick Status Bar */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${isRefreshing ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`} />
              <span className="font-medium">
                {isRefreshing ? "Updating ledger..." : "Live Auto-refresh (30s)"}
              </span>
            </span>
            <span>•</span>
            <span>Last sync: {formatLastUpdated(dataUpdatedAt)}</span>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          {/* Date Presets */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Date Period
            </label>
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Date Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Method
            </label>
            <Select
              value={method}
              onValueChange={(v) => {
                setMethod(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cashfree">Cashfree PG</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* City Filter */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              City
            </label>
            <Select
              value={city}
              onValueChange={(v) => {
                setCity(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                <SelectItem value="Varanasi">Varanasi</SelectItem>
                <SelectItem value="Noida">Noida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters CTA */}
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setMethod("all");
                setCity("all");
                setDatePreset("all");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="h-8 text-xs w-full text-muted-foreground hover:text-foreground"
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Custom Date Range Picker when Custom preset selected */}
        {datePreset === "custom" && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs w-36"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. DENSE TRANSACTION TABLE */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="payment-ledger-table">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              <tr>
                <th className="text-left px-3.5 py-3 uppercase tracking-wider">Date & Time (IST)</th>
                <th className="text-left px-3.5 py-3 uppercase tracking-wider">Customer</th>
                <th className="text-left px-3.5 py-3 uppercase tracking-wider">City</th>
                <th className="text-left px-3.5 py-3 uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-3.5 py-3 uppercase tracking-wider">Service</th>
                <th className="text-right px-3.5 py-3 uppercase tracking-wider">Amount Paid</th>
                <th className="text-right px-3.5 py-3 uppercase tracking-wider">Remaining Due</th>
                <th className="text-left px-3.5 py-3 uppercase tracking-wider">Method</th>
                <th className="text-left px-3.5 py-3 uppercase tracking-wider">Gateway Order ID</th>
                <th className="text-center px-3.5 py-3 uppercase tracking-wider">Status</th>
                <th className="text-right px-3.5 py-3 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLedgerLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={11} className="px-3.5 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : (ledgerData?.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground">
                    <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="font-medium text-sm">No payment records found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Try clearing filters or adjusting your date range.
                    </p>
                  </td>
                </tr>
              ) : (
                ledgerData?.data.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors"
                    data-testid={`ledger-row-${row.id}`}
                  >
                    {/* Timestamp */}
                    <td className="px-3.5 py-3 font-medium whitespace-nowrap">
                      {row.paymentDateIst}
                    </td>

                    {/* Customer */}
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-foreground">{row.customerName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{row.customerPhone}</div>
                    </td>

                    {/* City */}
                    <td className="px-3.5 py-3 whitespace-nowrap text-muted-foreground">
                      {row.city}
                    </td>

                    {/* Invoice */}
                    <td className="px-3.5 py-3 whitespace-nowrap font-mono text-[11px]">
                      {row.invoiceId ? (
                        <a
                          href={`/api/invoices/${row.invoiceId}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-medium flex items-center gap-1"
                        >
                          <span>{row.invoiceNumber}</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{row.invoiceNumber}</span>
                      )}
                    </td>

                    {/* Service */}
                    <td className="px-3.5 py-3 max-w-[160px] truncate" title={row.serviceDescription}>
                      {row.serviceDescription}
                    </td>

                    {/* Amount Paid */}
                    <td className="px-3.5 py-3 text-right font-bold text-foreground whitespace-nowrap font-mono">
                      ₹{row.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* Remaining Due */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap font-mono">
                      {row.remainingDue != null ? (
                        <span className={row.remainingDue > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
                          ₹{row.remainingDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Payment Method */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {row.paymentMethod?.toLowerCase() === "cashfree" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          Cashfree
                        </span>
                      ) : (
                        <span className="uppercase text-muted-foreground text-[11px] font-medium">
                          {row.paymentMethod}
                        </span>
                      )}
                    </td>

                    {/* Gateway Order ID */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {row.cfOrderId ? (
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="truncate max-w-[120px]" title={row.cfOrderId}>
                            {row.cfOrderId}
                          </span>
                          <button
                            onClick={() => handleCopyMonospace(row.cfOrderId!, `cf-${row.id}`)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy Order ID"
                          >
                            {copiedId === `cf-${row.id}` ? (
                              <Check size={11} className="text-emerald-500" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      {renderStatusBadge(row.status)}
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTx(row);
                          setDrawerOpen(true);
                        }}
                        data-testid={`btn-view-details-${row.id}`}
                        className="h-7 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 font-medium"
                      >
                        <Eye size={12} className="mr-1" />
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-3.5 border-t border-border bg-muted/20 text-xs">
          <div className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{ledgerData?.data.length ?? 0}</span> of{" "}
            <span className="font-medium text-foreground">{ledgerData?.total ?? 0}</span> transactions
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 text-xs"
            >
              <ChevronLeft size={13} className="mr-0.5" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {ledgerData?.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (ledgerData?.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-2 text-xs"
            >
              Next
              <ChevronRight size={13} className="ml-0.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 4. TRANSACTION DETAILS DRAWER */}
      <TransactionDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        transaction={selectedTx}
      />
    </PageTemplate>
  );
}
