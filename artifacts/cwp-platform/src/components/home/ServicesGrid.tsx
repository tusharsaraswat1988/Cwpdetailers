import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  Droplets,
  ShieldCheck,
  SunMedium,
  Shield,
  ArrowRight,
  Star,
} from "lucide-react";
import { CWP_PRODUCT_LIST } from "@/lib/cwp-products-data";
import { useCityCatalogServices } from "@/features/master-data/api";
import { CustomerCard, CustomerButton } from "@/features/customer-ds";
import { cn } from "@/lib/utils";

import heroVehicle from "@/assets/images/landing/hero-vehicle.jpg";
import serviceWash from "@/assets/images/service-wash.png";
import serviceInterior from "@/assets/images/service-interior.png";
import serviceCeramic from "@/assets/images/service-ceramic.png";
import serviceSolar from "@/assets/images/service-solar.png";

interface ServicesGridProps {
  hasDailyCleaningPlan?: boolean;
  className?: string;
  citySlug?: string;
  cityName?: string;
}

const SERVICE_IMAGES: Record<string, string> = {
  "daily-car-cleaning": heroVehicle,
  "doorstep-car-wash": serviceWash,
  "interior-detailing": serviceInterior,
  "ceramic-coating": serviceCeramic,
  "solar-cleaning": serviceSolar,
  "glass-repellent": heroVehicle,
};

const SERVICE_BENEFITS: Record<string, string> = {
  "daily-car-cleaning": "Morning doorstep microfiber dust removal with monthly deep foam washes.",
  "doorstep-car-wash": "100% RO water snow foam exterior wash, rim shine & cabin vacuum.",
  "interior-detailing": "Deep steam extraction, seat shampooing & AC ozone sanitization.",
  "ceramic-coating": "9H German ceramic shield with multi-stage paint swirl correction.",
  "solar-cleaning": "Deionized soft-brush rooftop wash restoring up to 25% power generation.",
  "glass-repellent": "Hydrophobic windshield & glass rain repellent coating.",
};

export function ServicesGrid({ className, citySlug, cityName }: ServicesGridProps) {
  const cityCatalogQuery = useCityCatalogServices(citySlug);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const availableServices = useMemo(() => {
    if (!citySlug) {
      return CWP_PRODUCT_LIST;
    }
    if (!cityCatalogQuery.data) {
      return cityCatalogQuery.isLoading ? [] : CWP_PRODUCT_LIST;
    }
    if (cityCatalogQuery.data.length === 0) {
      return [];
    }

    const catalogData = cityCatalogQuery.data;
    const activeCategories = new Set(catalogData.map((s) => s.category?.toLowerCase()).filter(Boolean));
    const activeSlugs = new Set(catalogData.map((s) => s.slug?.toLowerCase()).filter(Boolean));
    const priceBySlug = new Map(
      catalogData.map((s) => [s.slug?.toLowerCase(), s.basePrice || (s as any).cityBaseOverride])
    );

    return CWP_PRODUCT_LIST.filter((prod) => {
      if (activeSlugs.has(prod.slug.toLowerCase())) return true;
      if (
        prod.serviceType === "daily_cleaning" &&
        (activeCategories.has("subscription") || activeCategories.has("daily_cleaning"))
      )
        return true;
      if (prod.serviceType === "car_wash" && activeCategories.has("car_wash")) return true;
      if (prod.serviceType === "detailing" && activeCategories.has("detailing")) return true;
      if (
        prod.serviceType === "solar_cleaning" &&
        (activeCategories.has("solar_cleaning") || activeCategories.has("amc"))
      )
        return true;
      return false;
    }).map((prod) => {
      const customPrice = priceBySlug.get(prod.slug.toLowerCase());
      if (customPrice && Number(customPrice) > 0) {
        return { ...prod, startingPrice: Number(customPrice) };
      }
      return prod;
    });
  }, [citySlug, cityCatalogQuery.data, cityCatalogQuery.isLoading]);

  // Dynamic categories based on available services
  const dynamicCategories = useMemo(() => {
    const cats: Array<{ id: string; label: string; icon: any }> = [
      { id: "all", label: "All Services", icon: Sparkles },
    ];
    if (availableServices.some((s) => s.serviceType === "daily_cleaning")) {
      cats.push({ id: "daily_cleaning", label: "Daily Cleaning", icon: Sparkles });
    }
    if (availableServices.some((s) => s.serviceType === "car_wash")) {
      cats.push({ id: "car_wash", label: "Car Wash", icon: Droplets });
    }
    if (availableServices.some((s) => s.serviceType === "detailing")) {
      cats.push({ id: "detailing", label: "Detailing", icon: ShieldCheck });
    }
    if (availableServices.some((s) => s.serviceType === "solar_cleaning")) {
      cats.push({ id: "solar_cleaning", label: "Solar Care", icon: SunMedium });
    }
    return cats;
  }, [availableServices]);

  const filteredServices = useMemo(() => {
    if (activeCategory === "all") return availableServices;
    return availableServices.filter((s) => s.serviceType === activeCategory);
  }, [availableServices, activeCategory]);

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="cwp-services-heading" data-testid="cwp-services-showcase">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="cwp-services-heading" className="font-display font-extrabold text-lg text-foreground">
            {cityName ? `Services in ${cityName}` : "CWP Certified Services"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Doorstep vehicle care and rooftop solar cleaning
          </p>
        </div>
        <Link
          href="/customer/services"
          className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
        >
          View All <ArrowRight size={13} />
        </Link>
      </div>

      {/* Dynamic Category Chips */}
      {dynamicCategories.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {dynamicCategories.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border select-none",
                  active
                    ? "bg-primary text-white border-primary shadow-2xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
                data-testid={`grid-cat-${cat.id}`}
              >
                <Icon size={13} className={active ? "text-white" : "text-primary"} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {availableServices.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center"
          data-testid="services-unavailable-banner"
        >
          <Sparkles className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <h3 className="font-semibold text-sm text-foreground">Services Launching Soon</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {cityName
              ? `Services in ${cityName} are currently being onboarded.`
              : "No services currently available for this selection."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredServices.map((prod) => {
            const imageSrc = SERVICE_IMAGES[prod.slug] || heroVehicle;
            const shortBenefit = SERVICE_BENEFITS[prod.slug] || prod.shortDescription;

            return (
              <CustomerCard
                key={prod.slug}
                className="overflow-hidden flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all duration-200 group bg-white border border-slate-200 rounded-2xl"
                data-testid={`service-card-${prod.slug}`}
              >
                {/* Visual Thumbnail */}
                <Link
                  href={`/customer/services/${prod.slug}`}
                  className="block relative aspect-[16/10] overflow-hidden bg-slate-100 cursor-pointer"
                >
                  <img
                    src={imageSrc}
                    alt={prod.title}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-slate-800 shadow-2xs">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    <span>{prod.rating}</span>
                  </div>
                </Link>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <Link href={`/customer/services/${prod.slug}`} className="block">
                      <h3 className="font-display font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                        {prod.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {shortBenefit}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                        Starts from
                      </span>
                      <p className="font-display font-black text-base text-foreground">
                        ₹{prod.startingPrice}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {prod.priceUnit}
                        </span>
                      </p>
                    </div>

                    <Link href={`/customer/services/${prod.slug}`}>
                      <CustomerButton
                        variant="default"
                        size="sm"
                        className="min-h-[40px] px-3.5 text-xs font-bold gap-1 rounded-xl shadow-2xs cursor-pointer"
                        data-testid={`view-service-btn-${prod.slug}`}
                      >
                        <span>View Service</span>
                        <ArrowRight size={13} />
                      </CustomerButton>
                    </Link>
                  </div>
                </div>
              </CustomerCard>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ServicesGrid;
