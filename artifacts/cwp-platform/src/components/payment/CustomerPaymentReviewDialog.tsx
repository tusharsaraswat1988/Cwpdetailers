import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShieldCheck, Lock, ArrowRight, Loader2, CheckCircle2, MessageCircle, Home } from "lucide-react";
import { launchCashfreeCheckout } from "@/lib/cashfree";
import { toast } from "@/hooks/use-toast";
import { buildWhatsAppPaymentUrl } from "@/lib/paymentCustomerShield";

export interface CustomerPaymentReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: number;
  customerName?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  serviceDescription?: string;
  outstandingAmount?: number;
  payableAmount?: number;
  onPaymentInitiated?: () => void;
  onPaymentSuccess?: () => void;
}

export function CustomerPaymentReviewDialog({
  open,
  onOpenChange,
  customerId,
  customerName = "Valued Customer",
  invoiceId,
  invoiceNumber,
  serviceDescription = "Doorstep Detailing & Vehicle Care Services",
  outstandingAmount,
  payableAmount,
  onPaymentInitiated,
  onPaymentSuccess,
}: CustomerPaymentReviewDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAlternativeOptions, setShowAlternativeOptions] = useState(false);
  const [isSettled, setIsSettled] = useState(false);

  const effectiveOutstanding = Math.max(0, Number(outstandingAmount ?? payableAmount ?? 0));
  const effectivePayable = Math.max(0, Number(payableAmount ?? outstandingAmount ?? 0));

  const handleProceedToPayment = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Server-side payment order creation
      const res = await fetch("/api/payments/cashfree/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          invoiceId: invoiceId ?? undefined,
          returnUrl: "/customer/payment/return?order_id={order_id}",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.warn("[CustomerPaymentReviewDialog] Gateway order creation response:", data);
        if (data.code === "NO_OUTSTANDING_DUES") {
          setIsSettled(true);
        } else {
          // Never display raw technical errors, gateway rejection codes, or scary red boxes to the customer
          setShowAlternativeOptions(true);
        }
        setIsProcessing(false);
        return;
      }

      onPaymentInitiated?.();

      // 2. Launch Cashfree Hosted Web Checkout
      await launchCashfreeCheckout({
        paymentSessionId: data.paymentSessionId,
        environment: data.environment || "sandbox",
        redirectTarget: "_self",
      });
    } catch (err: any) {
      console.warn("[CustomerPaymentReviewDialog] Checkout exception:", err);
      // Shield the customer from raw exceptions, stack traces, and network failure messages
      setShowAlternativeOptions(true);
      setIsProcessing(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!isProcessing) {
      if (!val) {
        setShowAlternativeOptions(false);
        setIsSettled(false);
      }
      onOpenChange(val);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-xl bg-white">
        {/* Header with CWP Branding & Security Badge */}
        <div className="bg-[#0B1D36] text-white p-6 pb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg text-white">CWP</span>
              <span className="text-xs uppercase tracking-wider text-blue-200 font-semibold bg-white/10 px-2 py-0.5 rounded">
                Detailers
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>256-Bit SSL</span>
            </div>
          </div>
          <DialogTitle className="text-xl font-bold text-white tracking-tight">
            Payment Review
          </DialogTitle>
          <DialogDescription className="text-blue-200/80 text-xs mt-1">
            Review your outstanding balance and proceed to secure checkout.
          </DialogDescription>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 bg-[#F5F7FA]">
          {/* Hero Payable Amount Box */}
          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] text-center shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
              Amount Payable
            </p>
            <div className="text-3xl font-extrabold text-[#111827] tracking-tight">
              ₹{effectivePayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1 font-medium">Currency: INR</p>
          </div>

          {/* Breakdown Details */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] space-y-2.5 text-xs shadow-xs">
            <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Customer Name</span>
              <span className="font-semibold text-[#111827]">{customerName}</span>
            </div>

            {invoiceNumber && (
              <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Invoice Number</span>
                <span className="font-mono font-semibold text-[#111827]">{invoiceNumber}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Service Details</span>
              <span className="font-medium text-[#111827] truncate max-w-[200px]" title={serviceDescription}>
                {serviceDescription}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Total Outstanding</span>
              <span className="font-semibold text-[#111827]">
                ₹{effectiveOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-[#64748B]">Gateway Provider</span>
              <span className="font-semibold text-blue-600 flex items-center gap-1">
                Cashfree Payments
              </span>
            </div>
          </div>

          {/* Friendly Concierge & Alternative Payment Options (Zero Technical Errors) */}
          {showAlternativeOptions && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-800">Alternative Payment Options</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                You can complete your payment via WhatsApp UPI QR code, or pay our detailing specialist directly upon service delivery.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <a
                  href={buildWhatsAppPaymentUrl(effectivePayable, "917054007733", invoiceNumber)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[38px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <MessageCircle size={14} />
                  <span>WhatsApp UPI</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    toast({
                      title: "Doorstep Payment Noted",
                      description: "You can pay our specialist via UPI, card, or cash during your service visit.",
                    });
                    handleClose(false);
                  }}
                  className="min-h-[38px] rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Home size={14} />
                  <span>Pay at Doorstep</span>
                </button>
              </div>
            </div>
          )}

          {/* All Settled State */}
          {isSettled && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900 animate-in fade-in duration-200">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-emerald-950">All Dues Cleared</p>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Your account has no outstanding balance at this time. Thank you!
                </p>
              </div>
            </div>
          )}

          {/* Action CTAs */}
          <div className="space-y-2.5 pt-1">
            {isSettled ? (
              <button
                type="button"
                onClick={() => {
                  handleClose(false);
                  onPaymentSuccess?.();
                }}
                className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Done</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={isProcessing}
                data-testid="proceed-payment-button"
                className="w-full min-h-[48px] rounded-xl bg-[#1677FF] hover:bg-[#0958d9] active:bg-[#003eb3] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/15 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Connecting Secure Gateway...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>{showAlternativeOptions ? "Retry Online Payment" : "Proceed to Secure Payment"}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleClose(false)}
              disabled={isProcessing}
              className="w-full py-2.5 rounded-xl border border-transparent hover:bg-slate-200/60 text-[#64748B] hover:text-[#111827] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
