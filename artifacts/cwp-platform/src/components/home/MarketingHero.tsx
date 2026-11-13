import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  ShieldCheck,
  Droplet,
  Sun,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

interface MarketingHeroProps {
  cityName?: string;
  branchId?: number | null;
}

type HeroBanner = {
  id: number;
  title: string;
  subtitle?: string | null;
  bannerType?: "first_party" | "third_party" | "announcement";
  badgeText?: string | null;
  imageUrl?: string | null;
  desktopImageUrl?: string | null;
  mobileImageUrl?: string | null;
  altText?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  highlights?: string[] | null;
  advertiserName?: string | null;
  cityId?: number | null;
  branchId?: number | null;
};

export function MarketingHero({ cityName, branchId }: MarketingHeroProps = {}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Query city/branch hero banners
  const { data: bannerData } = useQuery<{ banners: HeroBanner[] }>({
    queryKey: ["marketing-hero-banners", cityName || "default", branchId || "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ placement: "home_hero" });
      if (cityName) params.set("citySlug", cityName);
      if (branchId) params.set("branchId", String(branchId));

      const res = await fetch(`/api/marketing/hero-banners?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        return { banners: json.banners || [] };
      }

      // Fallback to legacy promotions endpoint if marketing endpoint fails
      const fallbackRes = await fetch(`/api/promotions?${params.toString()}`, {
        credentials: "include",
      });
      if (!fallbackRes.ok) return { banners: [] };
      const fallbackJson = await fallbackRes.json();
      return { banners: fallbackJson.promotions || [] };
    },
    staleTime: 60000,
  });

  const banners = bannerData?.banners || [];
  const activeBanner = banners[currentIndex] || banners[0];

  // Auto-slide every 7 seconds only if more than 1 banner exists
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Helper to record click
  const handleCtaClick = () => {
    if (activeBanner?.id) {
      fetch("/api/marketing/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "banner_click",
          bannerId: activeBanner.id,
          cityId: activeBanner.cityId,
          branchId: activeBanner.branchId,
        }),
        credentials: "include",
      }).catch(() => {});
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  // Content resolution: dynamic promo first, then smart city-driven fallback
  const headlineCity = cityName || "Your City";
  const badgeText = activeBanner?.badgeText || `${headlineCity}'s #1 Doorstep Detailing & Auto Care`;
  const title = activeBanner?.title || "Showroom Shine at Your Doorstep, Every Single Morning.";
  const subtitle =
    activeBanner?.subtitle ||
    `Professional automotive care and doorstep cleaning in ${headlineCity}. We bring certified detailers, 100% RO water, and premium microfiber care right to your parking bay.`;

  const highlights =
    activeBanner?.highlights && activeBanner.highlights.length > 0
      ? activeBanner.highlights
      : ["Zero Scratches", "100% RO Water", "+25% Solar Power", "Certified Techs"];

  const ctaText = activeBanner?.ctaText || "Explore Services & Book";
  const ctaLink = activeBanner?.ctaLink || "#cwp-services-heading";

  const bannerImage = activeBanner?.desktopImageUrl || activeBanner?.imageUrl;

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

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 border border-white/15 text-xs font-semibold backdrop-blur-xs">
              <Sparkles size={13} className="text-blue-300" />
              <span>{badgeText}</span>
            </div>

            {activeBanner?.bannerType === "third_party" && (
              <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                Sponsored by {activeBanner.advertiserName || "Partner"}
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

        {/* Optional Banner Image / Media Preview */}
        {bannerImage && (
          <div className="relative shrink-0 hidden lg:block w-72 h-44 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <img
              src={bannerImage}
              alt={activeBanner?.altText || title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {/* Multi-banner Navigation Controls */}
      {banners.length > 1 && (
        <div className="relative z-10 flex items-center justify-between pt-4 mt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to banner ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Previous banner"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Next banner"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketingHero;
