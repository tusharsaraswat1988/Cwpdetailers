import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Receipt,
  User,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  FileText,
  AlertCircle,
  Code,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Calendar,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface LedgerRowData {
  id: string;
  sourceType: "payment" | "payment_attempt";
  paymentId: number | null;
  attemptId: string | null;
  paymentDate: string;
  paymentDateIst: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  city: string;
  branchId: number | null;
  branchName: string | null;
  bookingId: number | null;
  bookingRef: string | null;
  bookingDate?: string | null;
  serviceType: string;
  serviceDescription: string;
  paymentAmount: number;
  discount: number;
  amountPaid: number;
  remainingDue: number | null;
  paymentMethod: string;
  cfOrderId: string | null;
  cfPaymentId: string | null;
  internalReference: string;
  status:
    | "initiated"
    | "pending"
    | "paid"
    | "failed"
    | "cancelled"
    | "partially_refunded"
    | "refunded"
    | "requires_reconciliation";
  refundStatus: "none" | "partial" | "refunded";
  refundedAmount: number;
  lastUpdated: string;
  lastUpdatedIst: string;
  notes: string | null;
  subscriptionId?: number | null;
  rawWebhookPayload?: Record<string, unknown> | null;
  rawVerificationPayload?: Record<string, unknown> | null;
  timeline?: Array<{
    event: string;
    title: string;
    description: string;
    timestamp: string;
    timestampIst: string;
    source: "internal" | "gateway";
    status: "success" | "pending" | "failed" | "info";
  }>;
  refunds?: Array<any>;
}

interface TransactionDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: LedgerRowData | null;
  onTransactionUpdated?: () => void;
}

export function TransactionDetailsDrawer({
  open,
  onOpenChange,
  transaction,
  onTransactionUpdated,
}: TransactionDetailsDrawerProps) {
  const qc = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPayloads, setShowPayloads] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [refundReasonInput, setRefundReasonInput] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);

  // Fetch full details and timeline for selected transaction
  const { data: detailData, isLoading: isDetailLoading, refetch: refetchDetail } = useQuery<LedgerRowData>({
    queryKey: ["admin", "payments", "transaction-detail", transaction?.id],
    queryFn: async () => {
      if (!transaction?.id) return null as any;
      const res = await fetch(`/api/admin/payments/ledger/${transaction.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load transaction details");
      return res.json();
    },
    enabled: !!transaction?.id && open,
  });

  const tx = detailData || transaction;

  // Refundable Balance Query
  const { data: balanceData } = useQuery<{
    canRefund: boolean;
    refundableBalance: number;
    previouslyRefundedAmount: number;
  }>({
    queryKey: ["admin", "payments", "refundable-balance", tx?.id],
    queryFn: async () => {
      if (!tx?.id) return null as any;
      const res = await fetch(`/api/admin/payments/refundable-balance/${tx.id}`, {
        credentials: "include",
      });
      if (!res.ok) return null as any;
      return res.json();
    },
    enabled: !!tx?.id && open,
  });

  const refundMutation = useMutation({
    mutationFn: async (payload: { transactionId: string; amount: number; reason: string }) => {
      const res = await fetch("/api/admin/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund request failed");
      return data;
    },
    onSuccess: () => {
      setRefundModalOpen(false);
      setRefundAmountInput("");
      setRefundReasonInput("");
      setRefundError(null);
      refetchDetail();
      qc.invalidateQueries({ queryKey: ["admin", "payments", "ledger"] });
      qc.invalidateQueries({ queryKey: ["admin", "payments", "ledger", "summary"] });
      if (onTransactionUpdated) onTransactionUpdated();
    },
    onError: (err: any) => {
      setRefundError(err.message || "Refund failed");
    },
  });

  if (!tx) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getStatusBadge = (status: LedgerRowData["status"]) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase font-semibold text-xs tracking-wider">
            ● Paid
          </Badge>
        );
      case "partially_refunded":
        return (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 uppercase font-semibold text-xs tracking-wider">
            ● Partially Refunded
          </Badge>
        );
      case "refunded":
        return (
          <Badge className="bg-purple-50 text-purple-700 border border-purple-200 uppercase font-semibold text-xs tracking-wider">
            ● Refunded
          </Badge>
        );
      case "requires_reconciliation":
        return (
          <Badge className="bg-rose-50 text-rose-700 border border-rose-200 uppercase font-semibold text-xs tracking-wider">
            ● Needs Reconciliation
          </Badge>
        );
      case "pending":
      case "initiated":
        return (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 uppercase font-semibold text-xs tracking-wider">
            ● {status === "initiated" ? "Initiated" : "Pending"}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-rose-50 text-rose-700 border border-rose-200 uppercase font-semibold text-xs tracking-wider">
            ● Failed
          </Badge>
        );
      case "cancelled":
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border border-slate-200 uppercase font-semibold text-xs tracking-wider">
            ● Cancelled
          </Badge>
        );
    }
  };

  const openRefundDialog = () => {
    setRefundError(null);
    const maxBal = balanceData?.refundableBalance ?? tx.amountPaid;
    setRefundAmountInput(String(maxBal));
    setRefundReasonInput("");
    setRefundModalOpen(true);
  };

  const handleConfirmRefund = () => {
    const amt = parseFloat(refundAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setRefundError("Please enter a valid refund amount");
      return;
    }
    const maxBal = balanceData?.refundableBalance ?? tx.amountPaid;
    if (amt > maxBal) {
      setRefundError(`Amount cannot exceed available refundable balance of ₹${maxBal.toFixed(2)}`);
      return;
    }
    if (!refundReasonInput.trim()) {
      setRefundError("Please enter a reason for this refund");
      return;
    }

    refundMutation.mutate({
      transactionId: tx.id,
      amount: amt,
      reason: refundReasonInput.trim(),
    });
  };

  const canRefund = balanceData ? balanceData.canRefund : (tx.status === "paid" || tx.status === "partially_refunded");
  const availableRefundBalance = balanceData?.refundableBalance ?? (tx.amountPaid - (tx.refundedAmount || 0));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 overflow-y-auto bg-card border-l border-border"
          data-testid="transaction-details-drawer"
        >
          {/* Drawer Header */}
          <div className="p-6 border-b border-border bg-muted/20">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Transaction Details
              </span>
              {getStatusBadge(tx.status)}
            </div>
            <div className="flex items-baseline justify-between">
              <SheetTitle className="text-2xl font-bold font-display text-foreground tracking-tight">
                ₹{tx.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </SheetTitle>
              {canRefund && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openRefundDialog}
                  className="text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                  data-testid="btn-initiate-refund-drawer"
                >
                  <RotateCcw size={12} className="mr-1.5" /> Issue Refund
                </Button>
              )}
            </div>
            <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Clock size={13} className="text-muted-foreground" />
              <span>{tx.paymentDateIst} (IST)</span>
            </SheetDescription>
          </div>

          <div className="p-6 space-y-6">
            {/* Customer & Booking Profile Card */}
            <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <User size={14} className="text-primary" />
                <span>Customer &amp; Booking Association</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer Name</p>
                  <p className="font-semibold text-foreground">{tx.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer Phone</p>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-foreground font-medium">
                    <span>{tx.customerPhone}</span>
                    <button
                      onClick={() => handleCopy(tx.customerPhone, "phone")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy phone"
                    >
                      {copiedKey === "phone" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Service City &amp; Branch</p>
                  <p className="text-foreground font-medium text-xs flex items-center gap-1">
                    <MapPin size={12} className="text-muted-foreground" />
                    <span>{tx.city} {tx.branchName ? `· ${tx.branchName}` : ""}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Booking Reference</p>
                  {tx.bookingRef ? (
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs font-bold text-primary">{tx.bookingRef}</span>
                      {tx.bookingId && (
                        <a
                          href={`/admin/bookings/${tx.bookingId}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Direct Billing / DCMS</span>
                  )}
                </div>
                {tx.subscriptionId && (
                  <div className="col-span-2 pt-1 border-t">
                    <p className="text-xs text-muted-foreground">Linked Daily Cleaning Contract</p>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-mono font-bold mt-1">
                      DCMS #{tx.subscriptionId}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Gateway Identifiers */}
            <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <CreditCard size={14} className="text-primary" />
                <span>Payment &amp; Gateway Details</span>
              </div>
              <div className="space-y-2.5 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Payment Method</p>
                  <div className="mt-0.5">
                    {tx.paymentMethod?.toLowerCase() === "razorpay" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck size={13} className="text-emerald-600" />
                        Razorpay Checkout
                      </span>
                    ) : tx.paymentMethod?.toLowerCase() === "cashfree" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        <ShieldCheck size={13} className="text-blue-600" />
                        Cashfree Payments
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium uppercase bg-muted text-foreground">
                        {tx.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>

                {tx.cfOrderId && (
                  <div>
                    <p className="text-xs text-muted-foreground">Gateway Order ID</p>
                    <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border mt-0.5">
                      <span className="font-mono text-xs text-foreground truncate select-all">{tx.cfOrderId}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleCopy(tx.cfOrderId!, "cfOrderId")}
                      >
                        {copiedKey === "cfOrderId" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </Button>
                    </div>
                  </div>
                )}

                {tx.cfPaymentId && (
                  <div>
                    <p className="text-xs text-muted-foreground">Gateway Payment ID</p>
                    <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border mt-0.5">
                      <span className="font-mono text-xs text-foreground truncate select-all">{tx.cfPaymentId}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleCopy(tx.cfPaymentId!, "cfPaymentId")}
                      >
                        {copiedKey === "cfPaymentId" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div>
                    <span className="text-muted-foreground">Payment Amount:</span>
                    <p className="font-semibold text-foreground">₹{tx.paymentAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Discount Applied:</span>
                    <p className="font-semibold text-foreground">₹{(tx.discount || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Final Paid Amount:</span>
                    <p className="font-semibold text-emerald-600">₹{tx.amountPaid.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Refund Status:</span>
                    <p className="font-semibold capitalize text-foreground">
                      {tx.refundStatus !== "none" ? `${tx.refundStatus} (₹${(tx.refundedAmount || 0).toFixed(2)})` : "None"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Timeline */}
            <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Clock size={14} className="text-primary" />
                <span>Payment &amp; Settlement Timeline</span>
              </div>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {(tx.timeline && tx.timeline.length > 0 ? tx.timeline : [
                  {
                    event: "order_created",
                    title: "Order Session Created",
                    description: `Initiated session for ₹${tx.amountPaid.toFixed(2)}`,
                    timestampIst: tx.paymentDateIst,
                    source: "internal" as const,
                    status: "success" as const,
                  },
                  {
                    event: "payment_confirmed",
                    title: "Payment Credited",
                    description: `Recorded in billing ledger with status: ${tx.status.toUpperCase()}`,
                    timestampIst: tx.lastUpdatedIst || tx.paymentDateIst,
                    source: "internal" as const,
                    status: tx.status === "paid" ? ("success" as const) : ("info" as const),
                  },
                ]).map((t, idx) => (
                  <div key={idx} className="relative">
                    <span
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 bg-background ${
                        t.status === "success"
                          ? "border-emerald-500 bg-emerald-500"
                          : t.status === "failed"
                          ? "border-rose-500 bg-rose-500"
                          : "border-amber-500 bg-amber-500"
                      }`}
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{t.title}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {t.source}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground">{t.timestampIst} (IST)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Payloads Accordion */}
            {(tx.rawWebhookPayload || tx.rawVerificationPayload) && (
              <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
                <button
                  type="button"
                  onClick={() => setShowPayloads(!showPayloads)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Code size={14} className="text-primary" />
                    <span>Raw Gateway Payloads (Forensic Audit)</span>
                  </div>
                  {showPayloads ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showPayloads && (
                  <div className="space-y-4 pt-2 text-xs">
                    {tx.rawVerificationPayload && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground">Verification API Response</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() =>
                              handleCopy(JSON.stringify(tx.rawVerificationPayload, null, 2), "verifyPayload")
                            }
                          >
                            {copiedKey === "verifyPayload" ? <Check size={11} className="mr-1 text-emerald-500" /> : <Copy size={11} className="mr-1" />}
                            Copy JSON
                          </Button>
                        </div>
                        <pre className="p-3 bg-muted/60 rounded-lg border border-border font-mono text-[11px] text-foreground max-h-48 overflow-auto select-all">
                          {JSON.stringify(tx.rawVerificationPayload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {tx.rawWebhookPayload && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground">Webhook Event Payload</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() =>
                              handleCopy(JSON.stringify(tx.rawWebhookPayload, null, 2), "webhookPayload")
                            }
                          >
                            {copiedKey === "webhookPayload" ? <Check size={11} className="mr-1 text-emerald-500" /> : <Copy size={11} className="mr-1" />}
                            Copy JSON
                          </Button>
                        </div>
                        <pre className="p-3 bg-muted/60 rounded-lg border border-border font-mono text-[11px] text-foreground max-h-48 overflow-auto select-all">
                          {JSON.stringify(tx.rawWebhookPayload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Authorized Admin Refund Modal */}
      <Dialog open={refundModalOpen} onOpenChange={setRefundModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <RotateCcw size={18} /> Initiate Authorized Refund
            </DialogTitle>
            <DialogDescription className="text-xs">
              Process a full or partial refund back to the customer's original payment source via Cashfree.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Transaction Amount:</span>
                <span className="font-semibold text-foreground">₹{tx.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previously Refunded:</span>
                <span className="font-semibold text-foreground">₹{(tx.refundedAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="font-medium text-foreground">Available Refundable Balance:</span>
                <span className="font-bold text-emerald-600">₹{availableRefundBalance.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Refund Amount (INR)</Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                max={availableRefundBalance}
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                placeholder="Enter refund amount"
                className="text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Operational Reason (Mandatory Audit Trail)</Label>
              <Textarea
                rows={3}
                value={refundReasonInput}
                onChange={(e) => setRefundReasonInput(e.target.value)}
                placeholder="e.g. Service cancellation, Customer dispute resolved, Double payment..."
                className="text-xs"
              />
            </div>

            {refundError && (
              <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{refundError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefundModalOpen(false)}
              disabled={refundMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRefund}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? "Processing Refund..." : "Confirm & Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
