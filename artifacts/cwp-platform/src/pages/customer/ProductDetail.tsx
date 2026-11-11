import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { CWP_PRODUCTS } from "@/lib/cwp-products-data";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import {
  ArrowLeft,
  Star,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  Droplets,
  Wrench,
  ThumbsUp,
  Award,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerPage } from "@/features/customer-ds";

export default function CustomerProductDetailPage() {
  const [, params] = useRoute("/customer/services/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? "daily-car-cleaning";
  const product = CWP_PRODUCTS[slug] || CWP_PRODUCTS["daily-car-cleaning"];

  const [activeImage, setActiveImage] = useState(product.heroImage);
  const [selectedTier, setSelectedTier] = useState<number>(0);

  const handleBookNow = () => {
    if (product.slug === "daily-car-cleaning") {
      setLocation(CUSTOMER_ROUTES.plans);
      return;
    }
    // Navigate directly to schedule flow with context
    setLocation(`${CUSTOMER_ROUTES.schedule}?service=${encodeURIComponent(product.slug)}&from=product_detail`);
  };

  return (
    <CustomerLayout>
      <CustomerPage className="space-y-6 pb-[calc(var(--bottom-nav-height)+5.5rem)] md:pb-8">
        {/* Top Navigation & Back */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href={CUSTOMER_ROUTES.home}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-primary border border-blue-100">
            {product.category}
          </span>
        </div>

        {/* Hero Gallery & Header */}
        <section className="space-y-4">
          <div className="space-y-2">
            {product.badge && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                <Sparkles size={12} />
                {product.badge}
              </span>
            )}
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-foreground tracking-tight leading-tight">
              {product.title}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.shortDescription}
            </p>

            {/* Rating & Trust badge */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200/60">
                <Star size={14} className="fill-amber-500 text-amber-500" />
                <span>{product.rating}</span>
                <span className="font-normal text-amber-700">({product.totalReviews} reviews)</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck size={15} />
                <span>Verified Doorstep Professionals</span>
              </div>
            </div>
          </div>

          {/* Main Visual Image Gallery */}
          <div className="space-y-2.5">
            <div className="w-full h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative bg-slate-900">
              <img
                src={activeImage}
                alt={product.title}
                className="w-full h-full object-cover transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-4 right-4 text-white flex items-end justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200">Doorstep Service</span>
                  <p className="font-bold text-lg">{product.title}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-300">Starting from</span>
                  <p className="font-bold text-xl text-white">₹{product.startingPrice} <span className="text-xs font-normal text-slate-300">{product.priceUnit}</span></p>
                </div>
              </div>
            </div>

            {/* Thumbnail selector */}
            {product.galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`relative w-20 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      activeImage === img ? "border-primary ring-2 ring-primary/20 scale-102" : "border-slate-200 opacity-75 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Pricing Matrix */}
        <section className="space-y-3.5 pt-2" id="pricing">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg text-foreground">Transparent Pricing</h2>
              <p className="text-xs text-muted-foreground">Select your vehicle or solar size to view package</p>
            </div>
            <Award className="text-primary hidden sm:block" size={24} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {product.pricingTiers.map((tier, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedTier(idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                  selectedTier === idx
                    ? "border-primary bg-blue-50/40 ring-2 ring-primary/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-2.5 right-4 bg-primary text-white text-[10px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full shadow-xs">
                    Recommended
                  </span>
                )}
                <div>
                  <h3 className="font-display font-bold text-sm text-foreground">{tier.category}</h3>
                  <div className="mt-2.5 flex items-baseline gap-1">
                    <span className="font-display font-black text-2xl text-foreground">₹{tier.price}</span>
                    {tier.period && <span className="text-xs text-muted-foreground">{tier.period}</span>}
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-slate-600">
                    {tier.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBookNow();
                    }}
                    className={`w-full h-10 text-xs font-bold rounded-xl ${
                      selectedTier === idx ? "bg-primary text-white" : "bg-slate-100 hover:bg-slate-200 text-foreground"
                    }`}
                  >
                    Book This Tier
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Overview & Key Inclusions */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h2 className="font-display font-bold text-base text-foreground">Service Overview</h2>
            <p className="text-xs text-slate-600 leading-relaxed mt-2">{product.overview}</p>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary" />
              What's Included
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {product.inclusions.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works: Step-by-Step Process */}
        <section className="space-y-3 pt-1">
          <h2 className="font-display font-bold text-base text-foreground">How Our Team Operates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {product.processSteps.map((step) => (
              <div key={step.step} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-2">
                <span className="w-7 h-7 rounded-xl bg-primary text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                  {step.step}
                </span>
                <h3 className="font-display font-bold text-sm text-foreground">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Equipment & Chemicals Used */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-3">
          <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
            <Wrench size={16} className="text-primary" />
            Professional Equipment & Certified Chemicals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {product.equipmentAndChemicals.map((tool, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                <Droplets size={14} className="text-blue-500 shrink-0" />
                <span>{tool}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Verified Customer Feedback & Reviews */}
        <section className="space-y-3.5 pt-2" id="reviews">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-base text-foreground">Customer Feedbacks</h2>
              <p className="text-xs text-muted-foreground">Real reviews from verified car & solar owners</p>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-foreground">
              <Star size={16} className="fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {product.reviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-2.5 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm text-foreground">{rev.author}</p>
                    <p className="text-[11px] text-muted-foreground">{rev.vehicleOrSite} · {rev.date}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, sIdx) => (
                      <Star
                        key={sIdx}
                        size={12}
                        className={sIdx < Math.floor(rev.rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  "{rev.comment}"
                </p>
                {rev.verified && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                    <UserCheck size={13} />
                    <span>Verified Customer</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Guarantees Banner */}
        <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 text-white p-5 sm:p-6 shadow-md space-y-3">
          <h2 className="font-display font-bold text-base flex items-center gap-2">
            <ThumbsUp size={18} className="text-blue-400" />
            The CWP Quality & Satisfaction Guarantee
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
            {product.guarantees.map((guar, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-white/5 p-3 rounded-xl border border-white/10">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{guar}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Fixed / Mobile Bottom Booking Bar (Positioned cleanly above bottom nav) */}
        <div className="fixed bottom-[var(--bottom-nav-height)] inset-x-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Starts at</span>
              <p className="font-display font-black text-lg text-foreground">
                ₹{product.startingPrice} <span className="text-xs font-normal text-muted-foreground">{product.priceUnit}</span>
              </p>
            </div>
            <Button
              onClick={handleBookNow}
              className="px-6 h-11 bg-primary hover:bg-[#1264db] text-white font-bold text-xs rounded-xl shadow-xs"
            >
              {product.slug === "daily-car-cleaning" ? "View Plans" : "Book Service"} <ChevronRight size={14} />
            </Button>
          </div>
        </div>

        {/* Desktop Book Action Banner */}
        <div className="hidden md:flex items-center justify-between p-6 rounded-2xl bg-blue-50/80 border border-blue-100">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground">Ready to experience doorstep care?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Book now and get doorstep service at your scheduled convenience.</p>
          </div>
          <Button
            onClick={handleBookNow}
            size="lg"
            className="px-8 h-12 bg-primary hover:bg-[#1264db] text-white font-bold text-sm rounded-xl shadow-sm gap-2"
          >
            <Calendar size={16} />
            {product.slug === "daily-car-cleaning" ? "View Plans & Pricing" : "Schedule This Service"}
          </Button>
        </div>
      </CustomerPage>
    </CustomerLayout>
  );
}
