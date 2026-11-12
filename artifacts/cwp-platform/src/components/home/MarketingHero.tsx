import { useQuery } from "@tanstack/react-query";
import { Sparkles, ShieldCheck, Droplet, Sun, ArrowRight, CheckCircle2, Megaphone } from "lucide-react";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

interface MarketingHeroProps {
  cityName?: string;
}

type Promotion = {
  id: number;
  title: string;
  subtitle?: string | null;
  bannerType: "first_party" | "third_party" | "announcement";
  badgeText?: string | null;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  highlights?: string[] | null;
  advertiserName?: string | null;
  cityId?: number | null;
};

export function MarketingHero({ cityName }: MarketingHeroProps = {}) {
  // Query targeted hero promotion for this city
  const { data: promoData } = useQuery<{ promotions: Promotion[] }>({
    queryKey: ["promotions", "home_hero", cityName || "default"],
    queryFn: async () => {
      const params = new URLSearchParams({ placement: "home_hero" });
      if (cityName) params.set("citySlug", cityName);
      const res = await fetch(`/api/promotions?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return { promotions: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const activePromo = promoData?.promotions?.[0];

  // Helper to record click
  const handleCtaClick = () => {
    if (activePromo?.id) {
      fetch(`/api/promotions/${activePromo.id}/click`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  };

  // Content resolution: dynamic promo first, then smart city-driven fallback
  const headlineCity = cityName || "Your City";

  const badgeText = activePromo?.badgeText || `${headlineCity}'s #1 Doorstep Detailing & Auto Care`;

  const title = activePromo?.title || "Showroom Shine at Your Doorstep, Every Single Morning.";

  const subtitle = activePromo?.subtitle ||
    `Professional automotive care and doorstep cleaning in ${headlineCity}. We bring certified detailers, 100% RO water, and premium microfiber care right to your parking bay.`;

  const highlights = (activePromo?.highlights && activePromo.highlights.length > 0)
    ? activePromo.highlights
    : ["Zero Scratches", "100% RO Water", "+25% Solar Power", "Certified Techs"];

  const ctaText = activePromo?.ctaText || "Explore Services & Book";
  const ctaLink = activePromo?.ctaLink || "#cwp-services-heading";

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 border border-white/15 text-xs font-semibold backdrop-blur-xs">
            <Sparkles size={13} className="text-blue-300" />
            <span>{badgeText}</span>
          </div>

          {activePromo?.bannerType === "third_party" && (
            <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
              Sponsored by {activePromo.advertiserName || "Partner"}
            </span>
          )}
        </div>

        <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight">
          {title}
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
          {subtitle}
        </p>

        {/* Dynamic Highlight Pillars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {highlights.slice(0, 4).map((highlight, index) => {
            const icons = [ShieldCheck, Droplet, Sun, CheckCircle2];
            const colors = ["text-emerald-400", "text-cyan-400", "text-amber-400", "text-blue-400"];
            const Icon = icons[index % icons.length];
            const colorClass = colors[index % colors.length];

            return (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-200"
              >
                <Icon size={16} className={`${colorClass} shrink-0`} />
                <span>{highlight}</span>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex flex-wrap gap-3 items-center">
          {ctaLink.startsWith("/") ? (
            <Link
              href={ctaLink}
              onClick={handleCtaClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {ctaText} <ArrowRight size={14} />
            </Link>
          ) : (
            <a
              href={ctaLink}
              onClick={handleCtaClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {ctaText} <ArrowRight size={14} />
            </a>
          )}

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
