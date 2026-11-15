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
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B1D36] via-[#0E274D] to-[#123668] text-white p-4 sm:p-5 shadow-xs"
      data-testid="home-marketing-hero"
    >
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
        <div className="space-y-1.5 max-w-xl min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-blue-200 border border-white/15 text-[10px] font-semibold backdrop-blur-xs">
              <Sparkles size={11} className="text-blue-300" />
              <span>{badgeText}</span>
            </span>

            {activeBanner?.bannerType === "third_party" && (
              <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                Sponsored by {activeBanner.advertiserName || "Partner"}
              </span>
            )}
          </div>

          <h2 className="font-display font-semibold text-base sm:text-lg text-white tracking-tight leading-snug">
            {title}
          </h2>

          <p className="text-xs text-slate-300 leading-normal line-clamp-1 sm:line-clamp-2">
            {subtitle}
          </p>

          <div className="pt-1">
            {ctaLink.startsWith("/") ? (
              <Link
                href={ctaLink}
                onClick={handleCtaClick}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                {ctaText} <ArrowRight size={13} />
              </Link>
            ) : (
              <a
                href={ctaLink}
                onClick={handleCtaClick}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                {ctaText} <ArrowRight size={13} />
              </a>
            )}
          </div>
        </div>

        {/* Optional Banner Image / Media Preview (compact on desktop) */}
        {bannerImage && (
          <div className="relative shrink-0 hidden sm:block w-36 h-24 lg:w-44 lg:h-28 rounded-xl overflow-hidden border border-white/10 shadow-sm">
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
        <div className="relative z-10 flex items-center justify-between pt-2.5 mt-2 border-t border-white/10">
          <div className="flex items-center gap-1">
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to banner ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Previous banner"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Next banner"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketingHero;
