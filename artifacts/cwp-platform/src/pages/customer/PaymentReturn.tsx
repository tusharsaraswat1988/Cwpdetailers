import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import CustomerLayout from "@/components/layout/CustomerLayout";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  FileText,
  RotateCcw,
  ShieldCheck,
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { ReceiptModal, type ReceiptData } from "@/components/payment/ReceiptModal";
import { buildWhatsAppPaymentUrl } from "@/lib/paymentCustomerShield";

type VerificationStatus = "VERIFYING" | "PAID" | "FAILED" | "PENDING" | "USER_DROPPED";

interface VerificationResponse {
  success: boolean;
  status: "PAID" | "FAILED" | "PENDING" | "USER_DROPPED";
  orderId: string;
  amount?: number;
  paymentId?: string;
  paymentTime?: string;
  paymentMethod?: string;
  message?: string;
  receipt?: ReceiptData;
}

export default function CustomerPaymentReturn() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<VerificationStatus>("VERIFYING");
  const [verificationData, setVerificationData] = useState<VerificationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Extract order_id from current URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get("order_id");

  const verifyPayment = async () => {
    if (!orderId) {
      setStatus("FAILED");
      setErrorMessage("No order reference was found. Please return to your dashboard.");
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch(`/api/payments/cashfree/verify/${encodeURIComponent(orderId)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data: VerificationResponse = await res.json();

      if (!res.ok) {
        setStatus("FAILED");
        setErrorMessage("We could not confirm payment status at this moment. If any amount was debited, it will be automatically reconciled shortly.");
        return;
      }

      setVerificationData(data);
      setStatus(data.status || "PENDING");
      if (data.status === "PAID") {
        qc.invalidateQueries();
      }
    } catch (err: any) {
      setStatus("FAILED");
      setErrorMessage("We could not confirm payment status at this moment. Please check your dashboard or bank statement.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    verifyPayment();
  }, [orderId]);

  return (
    <CustomerLayout>
      <div className="max-w-md mx-auto py-8 px-4">
        {/* State 1: Verifying */}
        {status === "VERIFYING" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center shadow-lg space-y-5 animate-in fade-in duration-300">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-[#1677FF] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck size={24} className="text-[#1677FF]" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111827] tracking-tight">
                Verifying Your Payment
              </h1>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Please wait while we confirm your transaction securely with Cashfree.
              </p>
            </div>
            {orderId && (
              <div className="bg-[#F5F7FA] rounded-xl p-3 border border-[#E2E8F0] text-center">
                <span className="text-[11px] text-[#64748B] block mb-0.5">Order Reference</span>
                <span className="font-mono font-semibold text-xs text-[#111827]">{orderId}</span>
              </div>
            )}
          </div>
        )}

        {/* State 2: Success (PAID) */}
        {status === "PAID" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-2">
                Payment Successful
              </span>
              <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                Thank You for Your Payment!
              </h1>
              <p className="text-xs text-[#64748B] mt-1">
                Your transaction has been confirmed and applied to your account.
              </p>
            </div>

            {/* Summary Card */}
            <div className="bg-[#F5F7FA] rounded-xl p-4 border border-[#E2E8F0] space-y-2.5 text-xs text-left shadow-xs">
              {verificationData?.amount !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Amount Paid</span>
                  <span className="font-extrabold text-sm text-emerald-600 font-display">
                    ₹{verificationData.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {orderId && (
                <div className="flex justify-between items-center py-1 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Order Reference</span>
                  <span className="font-mono text-[#111827] truncate max-w-[190px]">{orderId}</span>
                </div>
              )}

              {verificationData?.paymentId && (
                <div className="flex justify-between items-center py-1 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Gateway Reference</span>
                  <span className="font-mono text-[#111827] truncate max-w-[190px]">{verificationData.paymentId}</span>
                </div>
              )}

              {verificationData?.receipt?.invoiceNumber && (
                <div className="flex justify-between items-center py-1 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Invoice Number</span>
                  <span className="font-mono font-semibold text-[#111827]">{verificationData.receipt.invoiceNumber}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <span className="text-[#64748B]">Status</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Settled
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              {verificationData?.receipt && (
                <button
                  type="button"
                  onClick={() => setReceiptModalOpen(true)}
                  className="w-full min-h-[46px] rounded-xl bg-[#0B1D36] hover:bg-[#162a4a] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <FileText size={16} />
                  <span>View Official Receipt</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setLocation(CUSTOMER_ROUTES.dashboard)}
                className="w-full min-h-[46px] rounded-xl bg-[#1677FF] hover:bg-[#0958d9] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-blue-500/15 cursor-pointer"
              >
                <span>Back to Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* State 3: Reassuring Status Update (Zero Alarming Errors) */}
        {status === "FAILED" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center mx-auto text-slate-700 shadow-xs">
              <ShieldCheck size={36} className="text-slate-600" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mb-2">
                Payment Update
              </span>
              <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                Payment Assistance
              </h1>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                If any amount was debited from your account, it is completely secure and will be automatically reconciled or refunded within 24–48 hours. No duplicate charge will be made.
              </p>
            </div>

            {orderId && (
              <div className="bg-[#F5F7FA] rounded-xl p-3 border border-[#E2E8F0] text-center text-xs">
                <span className="text-[11px] text-[#64748B] block mb-0.5">Reference ID</span>
                <span className="font-mono font-medium text-[#111827]">{orderId}</span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <a
                href={buildWhatsAppPaymentUrl(verificationData?.amount ?? 0, "917054007733", orderId || undefined)}
                target="_blank"
                rel="noreferrer"
                className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <MessageCircle size={16} />
                <span>Chat with WhatsApp Support</span>
              </a>

              <button
                type="button"
                onClick={() => setLocation(CUSTOMER_ROUTES.dashboard)}
                className="w-full min-h-[46px] rounded-xl bg-[#1677FF] hover:bg-[#0958d9] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw size={15} />
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        )}

        {/* State 4: Pending Confirmation */}
        {status === "PENDING" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-sm">
              <Clock size={36} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 mb-2">
                Payment Pending
              </span>
              <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                Payment Is Being Confirmed
              </h1>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Cashfree is awaiting bank confirmation for this payment. It may take a couple of minutes to clear.
              </p>
            </div>

            {orderId && (
              <div className="bg-[#F5F7FA] rounded-xl p-3 border border-[#E2E8F0] text-center text-xs">
                <span className="text-[11px] text-[#64748B] block mb-0.5">Order ID</span>
                <span className="font-mono font-medium text-[#111827]">{orderId}</span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={verifyPayment}
                disabled={refreshing}
                className="w-full min-h-[46px] rounded-xl bg-[#1677FF] hover:bg-[#0958d9] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                <span>{refreshing ? "Checking Gateway..." : "Refresh Payment Status"}</span>
              </button>

              <button
                type="button"
                onClick={() => setLocation(CUSTOMER_ROUTES.dashboard)}
                className="w-full py-2.5 rounded-xl border border-transparent hover:bg-slate-100 text-[#64748B] hover:text-[#111827] text-xs font-semibold transition-colors cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* State 5: User Dropped */}
        {status === "USER_DROPPED" && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center mx-auto text-slate-600 shadow-sm">
              <RotateCcw size={32} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 mb-2">
                Checkout Incomplete
              </span>
              <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                Payment Cancelled
              </h1>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                The Cashfree checkout window was closed before completing payment. No money was deducted.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setLocation(CUSTOMER_ROUTES.dashboard)}
                className="w-full min-h-[46px] rounded-xl bg-[#1677FF] hover:bg-[#0958d9] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Return to Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Receipt Modal */}
        {verificationData?.receipt && (
          <ReceiptModal
            open={receiptModalOpen}
            onOpenChange={setReceiptModalOpen}
            receipt={verificationData.receipt}
          />
        )}
      </div>
    </CustomerLayout>
  );
}
