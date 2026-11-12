import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  invoiceId: number | null;
  invoiceNumber: string | null;
  serviceDescription: string;
  invoiceAmount: number | null;
  amountPaid: number;
  remainingDue: number | null;
  paymentMethod: string;
  cfOrderId: string | null;
  cfPaymentId: string | null;
  internalReference: string;
  status: "success" | "pending" | "failed" | "abandoned" | "reversed";
  notes: string | null;
  rawWebhookPayload?: Record<string, unknown> | null;
  rawVerificationPayload?: Record<string, unknown> | null;
}

interface TransactionDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: LedgerRowData | null;
}

export function TransactionDetailsDrawer({
  open,
  onOpenChange,
  transaction,
}: TransactionDetailsDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPayloads, setShowPayloads] = useState(false);

  if (!transaction) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getStatusBadge = (status: LedgerRowData["status"]) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase font-semibold text-xs tracking-wider">
            ● Success
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 uppercase font-semibold text-xs tracking-wider">
            ● Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-rose-50 text-rose-700 border border-rose-200 uppercase font-semibold text-xs tracking-wider">
            ● Failed
          </Badge>
        );
      case "reversed":
        return (
          <Badge className="bg-purple-50 text-purple-700 border border-purple-200 uppercase font-semibold text-xs tracking-wider">
            ● Reversed
          </Badge>
        );
      case "abandoned":
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border border-slate-200 uppercase font-semibold text-xs tracking-wider">
            ● Abandoned
          </Badge>
        );
    }
  };

  return (
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
            {getStatusBadge(transaction.status)}
          </div>
          <SheetTitle className="text-xl font-bold font-display text-foreground tracking-tight">
            ₹{transaction.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Clock size={13} className="text-muted-foreground" />
            <span>{transaction.paymentDateIst} (IST)</span>
          </SheetDescription>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Profile Card */}
          <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <User size={14} className="text-primary" />
              <span>Customer Information</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-semibold text-foreground">{transaction.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <div className="flex items-center gap-1.5 font-mono text-xs text-foreground font-medium">
                  <span>{transaction.customerPhone}</span>
                  <button
                    onClick={() => handleCopy(transaction.customerPhone, "phone")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy phone"
                  >
                    {copiedKey === "phone" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer ID</p>
                <p className="font-mono text-xs text-foreground font-medium">#{transaction.customerId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Service City</p>
                <p className="text-foreground font-medium flex items-center gap-1">
                  <MapPin size={12} className="text-muted-foreground" />
                  <span>{transaction.city}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Payment & Gateway Identifiers */}
          <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <CreditCard size={14} className="text-primary" />
              <span>Gateway & Reconciliation Identifiers</span>
            </div>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <div className="mt-0.5">
                  {transaction.paymentMethod?.toLowerCase() === "cashfree" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200">
                      <ShieldCheck size={13} className="text-blue-600" />
                      Cashfree Hosted Checkout
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium uppercase bg-muted text-foreground">
                      {transaction.paymentMethod}
                    </span>
                  )}
                </div>
              </div>

              {transaction.cfOrderId && (
                <div>
                  <p className="text-xs text-muted-foreground">Cashfree Order ID</p>
                  <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border mt-0.5">
                    <span className="font-mono text-xs text-foreground truncate select-all">{transaction.cfOrderId}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopy(transaction.cfOrderId!, "cfOrderId")}
                    >
                      {copiedKey === "cfOrderId" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  </div>
                </div>
              )}

              {transaction.cfPaymentId && (
                <div>
                  <p className="text-xs text-muted-foreground">Cashfree Payment ID</p>
                  <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border mt-0.5">
                    <span className="font-mono text-xs text-foreground truncate select-all">{transaction.cfPaymentId}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleCopy(transaction.cfPaymentId!, "cfPaymentId")}
                    >
                      {copiedKey === "cfPaymentId" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Internal Reference</p>
                <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border mt-0.5">
                  <span className="font-mono text-xs text-foreground truncate select-all">{transaction.internalReference}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleCopy(transaction.internalReference, "internalRef")}
                  >
                    {copiedKey === "internalRef" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Associated Invoice Details */}
          <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Receipt size={14} className="text-primary" />
                <span>Invoice & Service Association</span>
              </div>
              {transaction.invoiceId && (
                <a
                  href={`/api/invoices/${transaction.invoiceId}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <FileText size={12} />
                  <span>View PDF</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border text-xs">
                <span className="text-muted-foreground">Invoice Reference:</span>
                <span className="font-mono font-medium text-foreground">{transaction.invoiceNumber || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border text-xs">
                <span className="text-muted-foreground">Service Description:</span>
                <span className="font-medium text-foreground text-right max-w-[240px] truncate">
                  {transaction.serviceDescription}
                </span>
              </div>
              {transaction.invoiceAmount != null && (
                <div className="flex justify-between py-1 border-b border-border text-xs">
                  <span className="text-muted-foreground">Original Invoice Total:</span>
                  <span className="font-semibold text-foreground">
                    ₹{transaction.invoiceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-border text-xs">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-semibold text-emerald-600">
                  ₹{transaction.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {transaction.remainingDue != null && (
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-muted-foreground">Remaining Invoice Due:</span>
                  <span className={`font-semibold ${transaction.remainingDue > 0 ? "text-amber-600" : "text-foreground"}`}>
                    ₹{transaction.remainingDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {transaction.notes && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/80 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Note: </span>
                {transaction.notes}
              </div>
            )}
          </div>

          {/* Technical Payloads Accordion */}
          {(transaction.rawWebhookPayload || transaction.rawVerificationPayload) && (
            <div className="rounded-xl border border-border p-4 bg-background shadow-xs space-y-3">
              <button
                type="button"
                onClick={() => setShowPayloads(!showPayloads)}
                className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Code size={14} className="text-primary" />
                  <span>Raw Gateway Payloads (Audit)</span>
                </div>
                {showPayloads ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showPayloads && (
                <div className="space-y-4 pt-2 text-xs">
                  {transaction.rawVerificationPayload && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">Verification API Response</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          onClick={() =>
                            handleCopy(JSON.stringify(transaction.rawVerificationPayload, null, 2), "verifyPayload")
                          }
                        >
                          {copiedKey === "verifyPayload" ? <Check size={11} className="mr-1 text-emerald-500" /> : <Copy size={11} className="mr-1" />}
                          Copy JSON
                        </Button>
                      </div>
                      <pre className="p-3 bg-muted/60 rounded-lg border border-border font-mono text-[11px] text-foreground max-h-48 overflow-auto select-all">
                        {JSON.stringify(transaction.rawVerificationPayload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {transaction.rawWebhookPayload && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">Webhook Event Payload</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          onClick={() =>
                            handleCopy(JSON.stringify(transaction.rawWebhookPayload, null, 2), "webhookPayload")
                          }
                        >
                          {copiedKey === "webhookPayload" ? <Check size={11} className="mr-1 text-emerald-500" /> : <Copy size={11} className="mr-1" />}
                          Copy JSON
                        </Button>
                      </div>
                      <pre className="p-3 bg-muted/60 rounded-lg border border-border font-mono text-[11px] text-foreground max-h-48 overflow-auto select-all">
                        {JSON.stringify(transaction.rawWebhookPayload, null, 2)}
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
  );
}
