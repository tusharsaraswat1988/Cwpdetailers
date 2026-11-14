import { useMemo } from "react";
import { Link } from "wouter";
import { useUxExperiment } from "@/hooks/use-ux-experiment";
import { CustomerButton } from "@/features/customer-ds";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdaptivePrimaryCTAProps {
  vehicleCount: number;
  hasActiveSubscription: boolean;
  activePlanName?: string;
  upcomingBooking?: {
    id: number;
    scheduledDate: string;
    serviceType?: string;
    status: string;
  } | null;
  cityName: string;
  customerId?: number | null;
}

export function AdaptivePrimaryCTA({
  vehicleCount,
  hasActiveSubscription,
  activePlanName,
  upcomingBooking,
  cityName,
  customerId,
}: AdaptivePrimaryCTAProps) {
  // A/B Experiment: 'homepage_primary_cta'
  const { getVariant, getConfig } = useUxExperiment({
    targetScreen: "homepage",
    customerId,
  });

  const ctaVariant = getVariant("homepage_primary_cta", "control");
  const ctaConfig = getConfig<{ headline?: string; buttonText?: string }>("homepage_primary_cta", {});

  // State 1: No vehicle added yet
  if (vehicleCount === 0) {
    return (
      <div
        className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        data-testid="adaptive-cta-add-vehicle"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Car size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px] font-bold uppercase tracking-wider bg-primary">
                Quick Setup
              </Badge>
              <span className="text-xs text-muted-foreground">Step 1 of 2</span>
            </div>
            <h2 className="font-display font-bold text-base text-foreground mt-1">
              Add your vehicle to see exact pricing in {cityName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hatchback, sedan, SUV, or luxury — unlock custom doorstep care.
            </p>
          </div>
        </div>

        <Link href="/customer/assets" className="self-start sm:self-auto shrink-0">
          <CustomerButton variant="primary" size="md" className="gap-2 shadow-xs cursor-pointer">
            Add Vehicle <ArrowRight size={15} />
          </CustomerButton>
        </Link>
      </div>
    );
  }

  // State 2: Active Daily Car Cleaning Subscription
  if (hasActiveSubscription) {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        data-testid="adaptive-cta-active-sub"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                <CheckCircle2 size={12} /> Active Plan
              </span>
              <span className="text-xs text-muted-foreground">{activePlanName || "Daily Cleaning"}</span>
            </div>
            <h2 className="font-display font-bold text-base text-foreground mt-1">
              Your vehicle is protected under daily doorstep care
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              View morning cleaning photos, visit history, or request a deep foam wash.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Link href="/customer/daily-cleaning">
            <CustomerButton variant="outline" size="sm" className="bg-white hover:bg-slate-50 cursor-pointer">
              Daily Route
            </CustomerButton>
          </Link>
          <Link href="/customer/schedule">
            <CustomerButton variant="primary" size="sm" className="gap-1.5 shadow-xs cursor-pointer">
              Book Add-on <ArrowRight size={14} />
            </CustomerButton>
          </Link>
        </div>
      </div>
    );
  }

  // State 3: Upcoming booking confirmed/scheduled
  if (upcomingBooking) {
    return (
      <div
        className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 to-cyan-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        data-testid="adaptive-cta-upcoming-booking"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Calendar size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                Upcoming Appointment
              </Badge>
              <span className="text-xs font-semibold text-primary capitalize">{upcomingBooking.status}</span>
            </div>
            <h2 className="font-display font-bold text-base text-foreground mt-1">
              Service scheduled for {upcomingBooking.scheduledDate}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track technician ETA or reschedule up to 2 hours before the slot.
            </p>
          </div>
        </div>

        <Link href={`/customer/schedule/${upcomingBooking.id}`} className="self-start sm:self-auto shrink-0">
          <CustomerButton variant="primary" size="md" className="gap-2 shadow-xs cursor-pointer">
            Track Booking <ArrowRight size={15} />
          </CustomerButton>
        </Link>
      </div>
    );
  }

  // State 4: Default bookable state with A/B Variant Assignment
  const headline =
    ctaConfig.headline ||
    (ctaVariant === "variant_offer"
      ? `Book Doorstep Wash in ${cityName} & Get Pure RO Shine`
      : ctaVariant === "variant_catalog"
      ? `Explore Certified Doorstep Detailing in ${cityName}`
      : `Book Doorstep Car Care in ${cityName}`);

  const buttonText =
    ctaConfig.buttonText ||
    (ctaVariant === "variant_offer"
      ? "Book with Offer"
      : ctaVariant === "variant_catalog"
      ? "View Catalog"
      : "Book Service");

  const targetUrl = ctaVariant === "variant_catalog" ? "/customer/services" : "/customer/schedule";

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-5 sm:p-6 shadow-md relative overflow-hidden"
      data-testid="adaptive-cta-book-service"
    >
      {/* Background glow decoration */}
      <div className="absolute right-0 top-0 -mt-8 -mr-8 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-blue-300 border border-primary/30 px-2 py-0.5 rounded-md">
              Doorstep Service
            </span>
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <Clock size={12} className="text-cyan-400" /> Slots open today in {cityName}
            </span>
          </div>

          <h2 className="font-display font-bold text-lg sm:text-xl text-white tracking-tight">
            {headline}
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed">
            100% RO soft-water wash, scratch-free microfibers, and certified detailers delivered to your parking spot.
          </p>
        </div>

        <Link href={targetUrl} className="self-start sm:self-auto shrink-0">
          <CustomerButton
            variant="primary"
            size="lg"
            className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold shadow-md cursor-pointer"
            data-testid="adaptive-primary-btn"
          >
            {buttonText} <ArrowRight size={16} />
          </CustomerButton>
        </Link>
      </div>
    </div>
  );
}
