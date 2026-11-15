import { useState, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { CWP_PRODUCTS } from "@/lib/cwp-products-data";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { CustomerPage, CustomerButton, CustomerCard } from "@/features/customer-ds";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import serviceSolar from "@/assets/images/service-solar.png";
import heroSolar from "@/assets/images/landing/hero-solar.jpg";
import beforeAfterSolar from "@/assets/images/landing/before-after-solar.jpg";
import serviceWash from "@/assets/images/service-wash.png";
import heroVehicle from "@/assets/images/landing/hero-vehicle.jpg";
import beforeAfterCar from "@/assets/images/landing/before-after-car.jpg";
import serviceCeramic from "@/assets/images/service-ceramic.png";
import serviceInterior from "@/assets/images/service-interior.png";

const LOCAL_FALLBACKS: Record<string, { hero: string; gallery: string[] }> = {
  "solar-cleaning": {
    hero: heroSolar,
    gallery: [heroSolar, serviceSolar, beforeAfterSolar],
  },
  "daily-car-cleaning": {
    hero: heroVehicle,
    gallery: [heroVehicle, beforeAfterCar, serviceWash],
  },
  "doorstep-car-wash": {
    hero: serviceWash,
    gallery: [serviceWash, heroVehicle, beforeAfterCar],
  },
  "interior-detailing": {
    hero: serviceInterior,
    gallery: [serviceInterior, heroVehicle, beforeAfterCar],
  },
  "ceramic-coating": {
    hero: serviceCeramic,
    gallery: [serviceCeramic, beforeAfterCar, heroVehicle],
  },
  "glass-repellent": {
    hero: beforeAfterCar,
    gallery: [beforeAfterCar, heroVehicle, serviceWash],
  },
};

export default function CustomerProductDetailPage() {
  const [, params] = useRoute("/customer/services/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? "daily-car-cleaning";
  const product = CWP_PRODUCTS[slug] || CWP_PRODUCTS["daily-car-cleaning"];

  const fallback = LOCAL_FALLBACKS[slug] || LOCAL_FALLBACKS["daily-car-cleaning"];
  const initialHero = product.heroImage || fallback.hero;

  const [mainImage, setMainImage] = useState<string>(initialHero);
  const [imgError, setImgError] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(() => {
    const popularIdx = product.pricingTiers.findIndex((t) => t.popular);
    return popularIdx >= 0 ? popularIdx : 0;
  });
  const [inclusionsExpanded, setInclusionsExpanded] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const displayImage = imgError ? fallback.hero : (mainImage || fallback.hero);
  const currentTier = product.pricingTiers[selectedTier] || product.pricingTiers[0];

  const handleBookNow = () => {
    const tier = currentTier;
    const tierParam = tier ? `&tier=${encodeURIComponent(tier.category)}&tierPrice=${tier.price}` : "";
    const segmentParam = product.serviceType ? `&segment=${encodeURIComponent(product.serviceType)}` : "";

    if (product.slug === "daily-car-cleaning") {
      setLocation(`${CUSTOMER_ROUTES.schedule}?service=daily-car-cleaning${tierParam}&segment=daily_cleaning&from=product_detail`);
      return;
    }

    setLocation(
      `${CUSTOMER_ROUTES.schedule}?service=${encodeURIComponent(product.slug)}${tierParam}${segmentParam}&from=product_detail`
    );
  };

  return (
    <CustomerLayout>
      <CustomerPage className="space-y-6 pb-36 md:pb-16 max-w-2xl mx-auto">
        {/* Top Navigation & Back */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href={CUSTOMER_ROUTES.services}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
            data-testid="service-detail-back-btn"
          >
            <ArrowLeft size={16} />
            Back to Services
          </Link>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-primary border border-blue-100">
            {product.category}
          </span>
        </div>

        {/* SECTION 1 — SERVICE IDENTITY */}
        <section className="space-y-3" data-testid="service-identity-section">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-foreground tracking-tight">
                {product.title}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {product.shortDescription}
            </p>

            {/* Compact verified rating */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-200">
                <Star size={12} className="fill-amber-500 text-amber-500" />
                <span>{product.rating}</span>
                <span className="font-normal text-amber-700">({product.totalReviews})</span>
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                Verified doorstep care
              </span>
            </div>
          </div>

          {/* Compact Visual Image */}
          <div className="w-full h-48 sm:h-56 rounded-2xl overflow-hidden border border-slate-200 shadow-xs relative bg-slate-100">
            <img
              src={displayImage}
              alt={product.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
              data-testid="service-detail-hero-image"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-4 right-4 text-white flex items-center justify-between">
              <span className="text-xs font-medium text-slate-200">
                Certified CWP Technician Team
              </span>
              <span className="text-xs font-bold text-white bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                Starts at ₹{product.startingPrice} {product.priceUnit}
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 2 — PRICING / PLAN SELECTION */}
        <section className="space-y-3" data-testid="service-pricing-section">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-base text-foreground">
                Select Vehicle / Plan
              </h2>
              <p className="text-xs text-muted-foreground">
                Choose the option that fits your vehicle or installation
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {product.pricingTiers.map((tier, idx) => {
              const isSelected = selectedTier === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedTier(idx)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? "border-primary bg-blue-50/50 ring-2 ring-primary/20 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                  data-testid={`pricing-tier-card-${idx}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedTier(idx);
                    }
                  }}
                  aria-pressed={isSelected}
                >
                  {tier.popular && (
                    <span className="absolute -top-2.5 right-3 bg-primary text-white text-[10px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full shadow-2xs">
                      Recommended
                    </span>
                  )}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-xs sm:text-sm text-foreground">
                        {tier.category}
                      </h3>
                      {isSelected ? (
                        <CheckCircle2 size={16} className="text-primary shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-display font-extrabold text-xl text-foreground">
                        ₹{tier.price}
                      </span>
                      {tier.period && (
                        <span className="text-[11px] text-muted-foreground font-normal">
                          {tier.period}
                        </span>
                      )}
                    </div>

                    {/* Concise 3-5 inclusions */}
                    <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                      {tier.features.slice(0, 4).map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-1.5 leading-snug">
                          <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 3 — WHAT'S INCLUDED (Expandable Progressive Disclosure) */}
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs" data-testid="service-inclusions-section">
          <button
            type="button"
            onClick={() => setInclusionsExpanded((prev) => !prev)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
            data-testid="toggle-inclusions-btn"
            aria-expanded={inclusionsExpanded}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <span className="font-semibold text-xs sm:text-sm text-foreground">
                What's Included in This Service ({product.inclusions.length} items)
              </span>
            </div>
            {inclusionsExpanded ? (
              <ChevronUp size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
          </button>

          {inclusionsExpanded && (
            <div className="p-4 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs text-slate-700 animate-in fade-in-50 duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.inclusions.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 4 — TERMS & CONDITIONS LINK & DIALOG */}
        <section className="flex items-center justify-between py-1 px-1">
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
            data-testid="terms-conditions-btn"
          >
            <FileText size={14} />
            <span>Service Terms & Cancellation Policy</span>
          </button>
        </section>

        <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
          <DialogContent className="max-w-md rounded-2xl p-6" data-testid="terms-dialog">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Terms & Conditions</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Clear guidelines for your certified doorstep service
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1">
                <h4 className="font-bold text-foreground text-xs">1. Free Cancellation & Rescheduling</h4>
                <p>You can cancel or reschedule any appointment up to 2 hours before the scheduled arrival time without any penalty or fee.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-foreground text-xs">2. Electricity & Water Access</h4>
                <p>For high-pressure washes and steam detailing, access to a standard electrical point and water outlet at your parking spot is required.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-foreground text-xs">3. 100% Scratch-Free Guarantee</h4>
                <p>We use dedicated separate dual-bucket microfiber mitts (450+ GSM). If any accidental swirl is caused during cleaning, CWP will provide free paint correction.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-foreground text-xs">4. Weather Delays</h4>
                <p>In the event of heavy rain or localized storms, services are automatically protected and rescheduled at your convenience.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* SECTION 5 — PERSISTENT BOOKING CTA */}
        {/* Mobile Fixed CTA */}
        <div
          className="fixed bottom-[var(--bottom-nav-height)] inset-x-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden"
          data-testid="mobile-sticky-cta"
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block truncate">
                {currentTier?.category || "Selected Tier"}
              </span>
              <p className="font-display font-extrabold text-base text-foreground">
                ₹{currentTier?.price} <span className="text-xs font-normal text-muted-foreground">{currentTier?.period || product.priceUnit}</span>
              </p>
            </div>
            <CustomerButton
              variant="default"
              size="lg"
              onClick={handleBookNow}
              className="min-h-[48px] px-6 font-bold text-xs rounded-xl shadow-xs gap-1.5 cursor-pointer shrink-0"
              data-testid="book-plan-cta"
            >
              <span>Book This Plan</span>
              <ArrowRight size={14} />
            </CustomerButton>
          </div>
        </div>

        {/* Desktop Persistent Card */}
        <div className="hidden md:flex items-center justify-between p-5 rounded-2xl bg-blue-50/80 border border-blue-100 mt-4">
          <div>
            <span className="text-[11px] font-bold uppercase text-primary tracking-wider">
              Selected Option: {currentTier?.category}
            </span>
            <p className="font-display font-extrabold text-xl text-foreground mt-0.5">
              ₹{currentTier?.price}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {currentTier?.period || product.priceUnit}
              </span>
            </p>
          </div>
          <CustomerButton
            variant="default"
            size="lg"
            onClick={handleBookNow}
            className="min-h-[48px] px-8 font-bold text-sm rounded-xl shadow-xs gap-2 cursor-pointer"
            data-testid="desktop-book-plan-cta"
          >
            <span>Book This Plan</span>
            <ArrowRight size={16} />
          </CustomerButton>
        </div>
      </CustomerPage>
    </CustomerLayout>
  );
}
