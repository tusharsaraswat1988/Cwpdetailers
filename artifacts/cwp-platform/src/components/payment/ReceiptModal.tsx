import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, Printer, X, Download } from "lucide-react";

export interface ReceiptData {
  paymentId: number;
  receiptNumber: string;
  invoiceNumber?: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  transactionId?: string;
  serviceDescription?: string;
}

export interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt?: ReceiptData | null;
}

export function ReceiptModal({ open, onOpenChange, receipt }: ReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-2xl bg-white print:border-none print:shadow-none">
        {/* Header */}
        <div className="bg-[#0B1D36] text-white p-6 pb-5 print:bg-white print:text-black">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-xl text-white print:text-black">CWP</span>
              <span className="text-xs uppercase tracking-wider text-blue-200 print:text-gray-700 font-semibold bg-white/10 px-2 py-0.5 rounded">
                Detailers
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full print:border-green-600 print:text-green-700">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Payment Verified</span>
            </div>
          </div>
          <DialogTitle className="text-lg font-bold text-white print:text-black tracking-tight">
            Official Payment Receipt
          </DialogTitle>
          <DialogDescription className="text-blue-200/80 print:text-gray-600 text-xs mt-0.5">
            Thank you for your business. Please retain this receipt for your records.
          </DialogDescription>
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-5 bg-[#F5F7FA] print:bg-white text-xs">
          {/* Hero Receipt Info */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex justify-between items-start pb-3 border-b border-[#F1F5F9]">
              <div>
                <p className="text-[11px] font-medium text-[#64748B]">Receipt Number</p>
                <p className="font-mono font-bold text-sm text-[#111827]">{receipt.receiptNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-[#64748B]">Payment Date</p>
                <p className="font-semibold text-xs text-[#111827]">{receipt.date}</p>
              </div>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Customer Name</span>
              <span className="font-semibold text-[#111827]">{receipt.customerName}</span>
            </div>

            {receipt.customerPhone && (
              <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Phone Number</span>
                <span className="font-mono text-[#111827]">{receipt.customerPhone}</span>
              </div>
            )}

            {receipt.invoiceNumber && (
              <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Invoice Reference</span>
                <span className="font-mono font-semibold text-[#111827]">{receipt.invoiceNumber}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Service Description</span>
              <span className="font-medium text-[#111827] text-right truncate max-w-[220px]">
                {receipt.serviceDescription || "Doorstep Detailing & Cleaning (SAC 9987)"}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
              <span className="text-[#64748B]">Payment Method</span>
              <span className="font-medium text-[#111827] capitalize">
                {receipt.paymentMethod || "Cashfree PG"}
              </span>
            </div>

            {receipt.transactionId && (
              <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
                <span className="text-[#64748B]">Transaction ID</span>
                <span className="font-mono text-[11px] text-[#111827] truncate max-w-[200px]" title={receipt.transactionId}>
                  {receipt.transactionId}
                </span>
              </div>
            )}

            {/* Total Paid */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold text-[#111827]">Amount Paid</span>
              <span className="text-base font-extrabold text-emerald-600 font-display">
                ₹{receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Legal details footer */}
          <div className="text-center text-[10px] text-[#64748B] space-y-1">
            <p className="font-semibold text-[#111827]">CWP Detailers • Kleansolar Services Private Limited</p>
            <p>Varanasi, Uttar Pradesh, India • SAC Code: 9987 (Automotive Detailing Services)</p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 pt-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 min-h-[44px] rounded-xl bg-[#0B1D36] hover:bg-[#162a4a] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer size={15} />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] px-5 rounded-xl border border-[#E2E8F0] hover:bg-slate-200/50 text-[#64748B] hover:text-[#111827] font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
