import { Sparkles, ShieldCheck, Droplet, Sun, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

export function MarketingHero() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1D36] via-[#0E274D] to-[#123668] text-white p-6 sm:p-8 shadow-md"
      data-testid="home-marketing-hero"
    >
      {/* Decorative background glow */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 space-y-4 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 border border-white/15 text-xs font-semibold backdrop-blur-xs">
          <Sparkles size={13} className="text-blue-300" />
          <span>Varanasi's #1 Doorstep Detailing & Solar Care</span>
        </div>

        <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight">
          Showroom Shine at Your Doorstep, Every Single Morning.
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
          Say goodbye to swirl marks from dirty cloths. We bring professional detailers, 100% RO water, and Korean 450 GSM microfibers right to your home or office parking.
        </p>

        {/* 4 Pillars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-200">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>Zero Scratches</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-200">
            <Droplet size={16} className="text-cyan-400 shrink-0" />
            <span>100% RO Water</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-200">
            <Sun size={16} className="text-amber-400 shrink-0" />
            <span>+25% Solar Power</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-200">
            <Sparkles size={16} className="text-blue-400 shrink-0" />
            <span>Certified Techs</span>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-3 items-center">
          <a
            href="#cwp-services-heading"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            Explore Services & Book <ArrowRight size={14} />
          </a>
          <Link
            href={CUSTOMER_ROUTES.plans}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer"
          >
            View Monthly Plans
          </Link>
        </div>
      </div>
    </div>
  );
}

export default MarketingHero;
