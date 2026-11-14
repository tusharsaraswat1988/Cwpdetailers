import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Car,
  Receipt,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { CustomerCard, CustomerButton } from "@/features/customer-ds";

interface ScheduleSuccessScreenProps {
  requestId: number;
  serviceName?: string;
  assetName?: string;
  assetSubtitle?: string;
  address?: string;
  date?: string;
  time?: string;
  paymentAmount?: number;
  coveredByPlan?: boolean;
  onScheduleAnother: () => void;
}

export function ScheduleSuccessScreen({
  requestId,
  serviceName = "Doorstep Service",
  assetName,
  assetSubtitle,
  address,
  date,
  time,
  paymentAmount,
  coveredByPlan = false,
  onScheduleAnother,
}: ScheduleSuccessScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4" data-testid="schedule-success">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md space-y-6 text-center"
      >
        {/* Animated Success Badge */}
        <div className="space-y-2">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 size={36} strokeWidth={2.2} />
          </div>
          <Badge variant="default" className="text-xs font-bold uppercase tracking-wider bg-emerald-600">
            Booking Confirmed
          </Badge>
          <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
            Appointment Booked!
          </h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your booking request has been assigned reference <span className="font-mono font-bold text-foreground">#{requestId}</span>. A technician will arrive at your scheduled window.
          </p>
        </div>

        {/* Detailed Booking Confirmation Card */}
        <CustomerCard className="p-4 sm:p-5 text-left divide-y divide-slate-100 bg-white shadow-sm border border-slate-200">
          {/* Service & Reference */}
          <div className="pb-3 flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Confirmed Service
              </span>
              <p className="font-display font-bold text-base text-foreground mt-0.5">
                {serviceName}
              </p>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-primary border border-blue-100">
              #{requestId}
            </span>
          </div>

          {/* Vehicle / Asset */}
          {(assetName || assetSubtitle) && (
            <div className="py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <Car size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Vehicle
                </span>
                <p className="text-xs font-bold text-foreground truncate">
                  {assetName}
                  {assetSubtitle ? ` · ${assetSubtitle}` : ""}
                </p>
              </div>
            </div>
          )}

          {/* Service Address */}
          {address && (
            <div className="py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Doorstep Address
                </span>
                <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                  {address}
                </p>
              </div>
            </div>
          )}

          {/* Date & Time Slot */}
          {(date || time) && (
            <div className="py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <Clock size={16} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Scheduled Appointment
                </span>
                <p className="text-xs font-bold text-foreground">
                  {date} {time ? `(${time})` : ""}
                </p>
              </div>
            </div>
          )}

          {/* Payment Status */}
          <div className="pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Payment Status</span>
            </div>
            {coveredByPlan ? (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                Included in Plan
              </span>
            ) : paymentAmount != null ? (
              <span className="text-xs font-bold text-foreground">
                ₹{paymentAmount.toLocaleString("en-IN")} (Pay on Service / Online)
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                Pending Confirmation
              </span>
            )}
          </div>
        </CustomerCard>

        {/* Clear Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <Link href={CUSTOMER_ROUTES.scheduledServiceDetail(requestId)} className="w-full">
            <CustomerButton variant="primary" size="lg" className="w-full gap-2 font-bold shadow-xs cursor-pointer">
              Track Service & ETA <ArrowRight size={16} />
            </CustomerButton>
          </Link>

          <Link href={CUSTOMER_ROUTES.serviceHistory} className="w-full">
            <CustomerButton variant="outline" size="md" className="w-full bg-white hover:bg-slate-50 cursor-pointer">
              View in My Bookings
            </CustomerButton>
          </Link>

          <button
            type="button"
            onClick={onScheduleAnother}
            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors py-2 cursor-pointer"
          >
            Schedule Another Service
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default ScheduleSuccessScreen;
