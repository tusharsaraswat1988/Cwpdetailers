import { useMemo } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  Droplets,
  ShieldCheck,
  SunMedium,
  ArrowRight,
  Star,
  Shield,
  Eye,
} from "lucide-react";
import { CWP_PRODUCT_LIST } from "@/lib/cwp-products-data";
import { useCityCatalogServices } from "@/features/master-data/api";
import { cn } from "@/lib/utils";

interface ServicesGridProps {
  hasDailyCleaningPlan?: boolean;
  className?: string;
  citySlug?: string;
  cityName?: string;
}

const serviceIcons: Record<string, any> = {
  "daily-car-cleaning": Sparkles,
  "doorstep-car-wash": Droplets,
  "interior-detailing": ShieldCheck,
  "ceramic-coating": Shield,
  "solar-cleaning": SunMedium,
  "glass-repellent": Eye,
};

const serviceAccents: Record<string, { bg: string; text: string; border: string }> = {
  "daily-car-cleaning": { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
  "doorstep-car-wash": { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-100" },
  "interior-detailing": { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
  "ceramic-coating": { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
  "solar-cleaning": { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  "glass-repellent": { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
};

export function ServicesGrid({ className, citySlug, cityName }: ServicesGridProps) {
  const cityCatalogQuery = useCityCatalogServices(citySlug);

  const availableServices = useMemo(() => {
    if (!citySlug || !cityCatalogQuery.data || cityCatalogQuery.data.length === 0) {
      return CWP_PRODUCT_LIST;
    }
    const catalogData = cityCatalogQuery.data;
    const activeCategories = new Set(catalogData.map(s => s.category?.toLowerCase()).filter(Boolean));
    const activeSlugs = new Set(catalogData.map(s => s.slug?.toLowerCase()).filter(Boolean));

    return CWP_PRODUCT_LIST.filter(prod => {
      if (activeSlugs.has(prod.slug.toLowerCase())) return true;
      if (prod.serviceType === "daily_cleaning" && (activeCategories.has("subscription") || activeCategories.has("daily_cleaning"))) return true;
      if (prod.serviceType === "car_wash" && activeCategories.has("car_wash")) return true;
      if (prod.serviceType === "detailing" && activeCategories.has("detailing")) return true;
      if (prod.serviceType === "solar_cleaning" && (activeCategories.has("solar_cleaning") || activeCategories.has("amc"))) return true;
      return false;
    });
  }, [citySlug, cityCatalogQuery.data]);

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="cwp-services-heading">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="cwp-services-heading" className="font-display font-bold text-lg text-foreground">
            {cityName ? `Services in ${cityName}` : "CWP Signature Services"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cityName
              ? `Doorstep vehicle care and cleaning services available in ${cityName}`
              : "Doorstep vehicle detailing & rooftop solar care with guaranteed results"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {availableServices.map((prod) => {
          const Icon = serviceIcons[prod.slug] || Sparkles;
          const accent = serviceAccents[prod.slug] || {
            bg: "bg-blue-50",
            text: "text-primary",
            border: "border-blue-100",
          };

          return (
            <Link
              key={prod.slug}
              href={`/customer/services/${prod.slug}`}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_2px_8px_rgba(11,29,54,0.04)] hover:shadow-[0_6px_20px_rgba(11,29,54,0.08)] hover:border-primary/50 active:scale-[0.985] transition-all duration-200 flex flex-col justify-between group text-left relative overflow-hidden cursor-pointer"
              data-testid={`service-card-${prod.slug}`}
            >
              {/* Product Card Top: Icon, Category & Rating */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform duration-200 group-hover:scale-105 shadow-2xs",
                      accent.bg,
                      accent.text,
                      accent.border
                    )}
                  >
                    <Icon size={22} />
                  </div>

                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-bold text-slate-700">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span>{prod.rating}</span>
                    <span className="text-slate-400 font-normal">({prod.totalReviews})</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {prod.category}
                  </span>
                  <h3 className="font-display font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                    {prod.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {prod.shortDescription}
                  </p>
                </div>

                {/* Micro tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {prod.features.slice(0, 2).map((feat, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center text-[10px] text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-md"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Product Card Footer: Price & Direct Page CTA */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-medium">Starts from</span>
                  <p className="font-display font-bold text-sm text-foreground">
                    ₹{prod.startingPrice} <span className="text-[10px] font-normal text-muted-foreground">{prod.priceUnit}</span>
                  </p>
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                  View & Book <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default ServicesGrid;
