import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import { useGetCustomer } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import {
  CustomerPage,
  CustomerCard,
  CustomerButton,
  CustomerSkeleton,
} from "@/features/customer-ds";
import {
  Search,
  Sparkles,
  Droplets,
  ShieldCheck,
  SunMedium,
  Shield,
  Star,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import heroVehicle from "@/assets/images/landing/hero-vehicle.jpg";
import serviceWash from "@/assets/images/service-wash.png";
import serviceInterior from "@/assets/images/service-interior.png";
import serviceCeramic from "@/assets/images/service-ceramic.png";
import serviceSolar from "@/assets/images/service-solar.png";

interface CatalogServiceItem {
  id: number;
  name: string;
  slug: string;
  code: string;
  description: string;
  shortDescription?: string;
  category: string;
  serviceType: string;
  basePrice: string | number;
  effectivePrice: number;
  durationMinutes?: number;
  gstRate?: string;
  pricingType?: string;
  imageUrl?: string | null;
}

const SERVICE_IMAGES: Record<string, string> = {
  "daily-car-cleaning": heroVehicle,
  "doorstep-car-wash": serviceWash,
  "interior-detailing": serviceInterior,
  "ceramic-coating": serviceCeramic,
  "solar-cleaning": serviceSolar,
};

const SERVICE_BENEFITS: Record<string, string> = {
  "daily-car-cleaning": "Morning doorstep microfiber dust removal with monthly deep foam washes.",
  "doorstep-car-wash": "100% RO water snow foam exterior wash, rim shine & cabin vacuum.",
  "interior-detailing": "Deep steam extraction, seat shampooing & AC ozone sanitization.",
  "ceramic-coating": "9H German ceramic shield with multi-stage paint swirl correction.",
  "solar-cleaning": "Deionized soft-brush rooftop wash restoring up to 25% power generation.",
};

export default function Services() {
  const [, setLocation] = useLocation();
  const { customerId } = useAccountScope();
  const [selectedCity, setSelectedCity] = useState<"varanasi" | "noida">("varanasi");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch customer profile to detect city
  const customerQuery = useGetCustomer(customerId ?? 0, {
    query: { enabled: !!customerId },
  });

  // Auto-detect city from customer address or city if available
  useEffect(() => {
    const rawCity = customerQuery.data?.city?.toLowerCase() || "";
    if (rawCity.includes("noida") || rawCity.includes("delhi") || rawCity.includes("ncr")) {
      setSelectedCity("noida");
    } else if (rawCity.includes("varanasi") || rawCity.includes("banaras") || rawCity.includes("kashi")) {
      setSelectedCity("varanasi");
    }
  }, [customerQuery.data?.city]);

  // Fetch city catalog
  const { data: services = [], isLoading } = useQuery<CatalogServiceItem[]>({
    queryKey: ["catalog-services", selectedCity],
    queryFn: async () => {
      const res = await fetch(`/api/catalog/services/${selectedCity}`);
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
    staleTime: 60000,
  });

  // Build dynamic, city-aware categories strictly based on active operational services in selected city
  const dynamicCategories = useMemo(() => {
    const cats: Array<{ id: string; label: string; icon: any }> = [
      { id: "all", label: "All Services", icon: Sparkles },
    ];

    const hasDaily = services.some(
      (s) => s.slug === "daily-car-cleaning" || s.serviceType === "daily_cleaning" || s.category === "subscription"
    );
    if (hasDaily) {
      cats.push({ id: "daily_cleaning", label: "Daily Car Cleaning", icon: Sparkles });
    }

    const hasWash = services.some(
      (s) => s.slug === "doorstep-car-wash" || s.serviceType === "car_wash" || s.category === "car_wash"
    );
    if (hasWash) {
      cats.push({ id: "car_wash", label: "Car Wash", icon: Droplets });
    }

    const hasInterior = services.some(
      (s) => s.slug === "interior-detailing" || s.name.toLowerCase().includes("interior")
    );
    if (hasInterior) {
      cats.push({ id: "interior_detailing", label: "Interior Detailing", icon: ShieldCheck });
    }

    const hasCeramic = services.some(
      (s) => s.slug === "ceramic-coating" || s.name.toLowerCase().includes("ceramic")
    );
    if (hasCeramic) {
      cats.push({ id: "ceramic_coating", label: "Ceramic Coating", icon: Shield });
    }

    const hasSolar = services.some(
      (s) => s.slug === "solar-cleaning" || s.serviceType === "solar_cleaning" || s.category === "solar_cleaning"
    );
    if (hasSolar) {
      cats.push({ id: "solar_care", label: "Solar Care", icon: SunMedium });
    }

    return cats;
  }, [services]);

  // If active category is not present in city's dynamic categories, reset to "all"
  useEffect(() => {
    const exists = dynamicCategories.some((c) => c.id === activeCategory);
    if (!exists) {
      setActiveCategory("all");
    }
  }, [dynamicCategories, activeCategory]);

  // Filter services by active category and search query
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      // Category filter
      if (activeCategory !== "all") {
        let matches = false;
        if (activeCategory === "daily_cleaning") {
          matches = svc.slug === "daily-car-cleaning" || svc.serviceType === "daily_cleaning" || svc.category === "subscription";
        } else if (activeCategory === "car_wash") {
          matches = svc.slug === "doorstep-car-wash" || svc.serviceType === "car_wash" || svc.category === "car_wash";
        } else if (activeCategory === "interior_detailing") {
          matches = svc.slug === "interior-detailing" || svc.name.toLowerCase().includes("interior");
        } else if (activeCategory === "ceramic_coating") {
          matches = svc.slug === "ceramic-coating" || svc.name.toLowerCase().includes("ceramic");
        } else if (activeCategory === "solar_care") {
          matches = svc.slug === "solar-cleaning" || svc.serviceType === "solar_cleaning" || svc.category === "solar_cleaning";
        }
        if (!matches) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = svc.name.toLowerCase().includes(q);
        const matchesDesc = (svc.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [services, activeCategory, searchQuery]);

  return (
    <CustomerLayout>
      <CustomerPage className="space-y-6 pb-20">
        {/* Header with City Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-extrabold text-2xl text-foreground tracking-tight">
              Service Catalog
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Certified doorstep car detailing & solar cleaning in your city
            </p>
          </div>

          {/* City Selector Pill */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto" data-testid="city-filter-container">
            <span className="text-[11px] font-semibold text-muted-foreground px-2 flex items-center gap-1">
              <MapPin size={12} className="text-primary" /> City:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCity("varanasi")}
              className={cn(
                "min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                selectedCity === "varanasi"
                  ? "bg-white text-primary shadow-xs border border-slate-200"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="city-btn-varanasi"
            >
              Varanasi
            </button>
            <button
              type="button"
              onClick={() => setSelectedCity("noida")}
              className={cn(
                "min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                selectedCity === "noida"
                  ? "bg-white text-primary shadow-xs border border-slate-200"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="city-btn-noida"
            >
              Noida
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search car wash, daily cleaning, ceramic, interior..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            data-testid="service-search-input"
          />
        </div>

        {/* Dynamic & City-Aware Category Filter Chips (Task 1) */}
        <div className="space-y-1.5" data-testid="service-category-filter">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            {dynamicCategories.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border select-none",
                    active
                      ? "bg-primary text-white border-primary shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                  data-testid={`category-filter-${cat.id}`}
                  aria-pressed={active}
                >
                  <Icon size={14} className={active ? "text-white" : "text-primary"} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual-First Service Catalog Grid (Task 2) */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CustomerSkeleton className="h-64 w-full rounded-2xl" />
            <CustomerSkeleton className="h-64 w-full rounded-2xl" />
            <CustomerSkeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center" data-testid="services-empty-state">
            <Sparkles className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <h3 className="font-semibold text-sm text-foreground">No services found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              No services match the selected category in this city. Try selecting "All Services".
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory("all");
                setSearchQuery("");
              }}
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5" data-testid="service-catalog-grid">
            {filteredServices.map((svc) => {
              const imageSrc = SERVICE_IMAGES[svc.slug] || heroVehicle;
              const shortBenefit = SERVICE_BENEFITS[svc.slug] || svc.shortDescription || svc.description;
              const isSubscription = svc.slug === "daily-car-cleaning" || svc.category === "subscription";

              return (
                <CustomerCard
                  key={svc.id}
                  className="overflow-hidden flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all duration-200 group bg-white border border-slate-200 rounded-2xl"
                  data-testid={`service-card-${svc.slug}`}
                >
                  {/* Visual Image Thumbnail (Consistent 16:10 aspect ratio) */}
                  <Link href={`/customer/services/${svc.slug}`} className="block relative aspect-[16/10] overflow-hidden bg-slate-100 cursor-pointer">
                    <img
                      src={imageSrc}
                      alt={svc.name}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold text-slate-800 shadow-2xs">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      <span>4.9</span>
                    </div>
                  </Link>

                  {/* Card Content: Title, Single Benefit Description */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <Link href={`/customer/services/${svc.slug}`} className="block">
                        <h3 className="font-display font-bold text-base text-foreground group-hover:text-primary transition-colors leading-snug">
                          {svc.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {shortBenefit}
                      </p>
                    </div>

                    {/* Card Footer: Starting Price & Clear Action CTA */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                          Starts at
                        </span>
                        <p className="font-display font-black text-lg text-foreground">
                          ₹{Number(svc.effectivePrice).toLocaleString("en-IN")}
                          <span className="text-xs font-normal text-muted-foreground ml-0.5">
                            {isSubscription ? "/mo" : ""}
                          </span>
                        </p>
                      </div>

                      <Link href={`/customer/services/${svc.slug}`}>
                        <CustomerButton
                          variant="default"
                          size="sm"
                          className="min-h-[40px] px-3.5 text-xs font-bold gap-1 rounded-xl shadow-2xs cursor-pointer"
                          data-testid={`view-service-btn-${svc.slug}`}
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
      </CustomerPage>
    </CustomerLayout>
  );
}
