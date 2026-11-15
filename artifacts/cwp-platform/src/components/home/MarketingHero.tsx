import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

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

      try {
        const res = await fetch(`/api/marketing/hero-banners?${params.toString()}`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          return { banners: json.banners || [] };
        }
      } catch {
        // Fallback below
      }

      // Fallback to legacy promotions endpoint if marketing endpoint fails
      try {
        const fallbackRes = await fetch(`/api/promotions?${params.toString()}`, {
          credentials: "include",
        });
        if (!fallbackRes.ok) return { banners: [] };
        const fallbackJson = await fallbackRes.json();
        return { banners: fallbackJson.promotions || [] };
      } catch {
        return { banners: [] };
      }
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

  const headlineCity = cityName || "Your City";
  const title = activeBanner?.title || "Showroom Shine at Your Doorstep";
  const subtitle =
    activeBanner?.subtitle ||
    `Certified detailers, 100% RO water, and doorstep vehicle care in ${headlineCity}.`;

  const ctaText = activeBanner?.ctaText || "Explore Services & Book";
  const ctaLink = activeBanner?.ctaLink || "#cwp-services-heading";
  const bannerImage = activeBanner?.desktopImageUrl || activeBanner?.imageUrl;

  const scrollToServices = (e: React.MouseEvent) => {
    handleCtaClick();
    if (ctaLink.startsWith("#")) {
      e.preventDefault();
      const targetId = ctaLink.replace("#", "");
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B1D36] via-[#0E274D] to-[#123668] text-white p-3.5 sm:p-4 shadow-xs"
      data-testid="home-marketing-hero"
    >
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <h2 className="font-display font-semibold text-sm sm:text-base text-white tracking-tight leading-tight truncate">
            {title}
          </h2>

          <p className="text-xs text-slate-300 leading-normal line-clamp-1">
            {subtitle}
          </p>

          <div className="pt-1.5 flex items-center gap-2">
            {ctaLink.startsWith("/") ? (
              <Link
                href={ctaLink}
                onClick={handleCtaClick}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[38px] touch-manipulation"
              >
                {ctaText} <ArrowRight size={13} />
              </Link>
            ) : (
              <a
                href={ctaLink}
                onClick={scrollToServices}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-[#1264db] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer min-h-[38px] touch-manipulation"
              >
                {ctaText} <ArrowRight size={13} />
              </a>
            )}

            {banners.length > 1 && (
              <div className="flex items-center gap-1 ml-2">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                    }`}
                    aria-label={`Go to banner ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compact Media Preview on tablet/desktop */}
        {bannerImage && (
          <div className="relative shrink-0 hidden sm:block w-28 h-20 rounded-xl overflow-hidden border border-white/10 shadow-xs">
            <img
              src={bannerImage}
              alt={activeBanner?.altText || title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketingHero;
