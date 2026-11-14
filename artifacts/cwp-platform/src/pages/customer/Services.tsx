import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import { useGetCustomer, useListVehicles } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import {
  CustomerPage,
  CustomerCard,
  CustomerButton,
  CustomerSkeleton,
} from "@/features/customer-ds";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Sparkles,
  Droplets,
  ShieldCheck,
  SunMedium,
  Shield,
  Clock,
  Car,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const CATEGORIES = [
  { id: "all", label: "All Services", icon: Sparkles },
  { id: "daily_cleaning", label: "Daily Cleaning", icon: Sparkles },
  { id: "car_wash", label: "Car Wash", icon: Droplets },
  { id: "detailing", label: "Detailing & Coating", icon: ShieldCheck },
  { id: "solar_cleaning", label: "Solar Care", icon: SunMedium },
];

const VEHICLE_CATEGORIES = [
  { id: "hatchback", label: "Hatchback", multiplier: 1.0 },
  { id: "sedan", label: "Sedan", multiplier: 1.15 },
  { id: "suv", label: "SUV / MUV", multiplier: 1.3 },
  { id: "luxury", label: "Luxury", multiplier: 1.5 },
];

export default function Services() {
  const [, setLocation] = useLocation();
  const { customerId } = useAccountScope();
  const [selectedCity, setSelectedCity] = useState<"varanasi" | "noida">("varanasi");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVehicleCategory, setSelectedVehicleCategory] = useState<string>("hatchback");

  // Fetch customer profile to detect city
  const customerQuery = useGetCustomer(customerId ?? 0, {
    query: { enabled: !!customerId },
  });

  // Fetch saved vehicles
  const vehiclesQuery = useListVehicles(
    { customerId: customerId ?? 0 },
    { query: { enabled: !!customerId } },
  );

  // Auto-detect city from customer address or city if available
  useEffect(() => {
    const rawCity = customerQuery.data?.city?.toLowerCase() || "";
    if (rawCity.includes("noida") || rawCity.includes("delhi") || rawCity.includes("ncr")) {
      setSelectedCity("noida");
    } else if (rawCity.includes("varanasi") || rawCity.includes("banaras") || rawCity.includes("kashi")) {
      setSelectedCity("varanasi");
    }
  }, [customerQuery.data?.city]);

  // Telemetry: service_viewed
  useEffect(() => {
    fetch("/api/marketing/funnel/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        milestone: "service_viewed",
        customerId,
        metadata: {
          screen: "service_catalog",
          city: selectedCity,
          category: activeCategory,
        },
      }),
    }).catch(() => {});
  }, [selectedCity, activeCategory, customerId]);

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

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      // Category filter
      if (activeCategory !== "all") {
        const matchesCategory =
          svc.category === activeCategory ||
          svc.serviceType === activeCategory ||
          (activeCategory === "daily_cleaning" && svc.category === "subscription");
        if (!matchesCategory) return false;
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

  const handleBookService = (svc: CatalogServiceItem) => {
    // Telemetry: service_selected
    fetch("/api/marketing/funnel/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        milestone: "service_selected",
        customerId,
        serviceId: svc.id,
        serviceName: svc.name,
        conversionValue: svc.effectivePrice,
        metadata: {
          city: selectedCity,
          vehicleCategory: selectedVehicleCategory,
        },
      }),
    }).catch(() => {});

    // Route to schedule flow with pre-selected service
    setLocation(`/customer/schedule?service=${svc.slug}&serviceId=${svc.id}&city=${selectedCity}`);
  };

  return (
    <CustomerLayout>
      <CustomerPage className="space-y-6">
        {/* Header with City Selector Pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">
              Doorstep Service Catalog
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Select your vehicle category and book certified doorstep care in your city
            </p>
          </div>

          {/* City Selector Pill */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
            <span className="text-[11px] font-semibold text-muted-foreground px-2 flex items-center gap-1">
              <MapPin size={12} className="text-primary" /> City:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCity("varanasi")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                selectedCity === "varanasi"
                  ? "bg-white text-primary shadow-xs border border-slate-200"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Varanasi
            </button>
            <button
              type="button"
              onClick={() => setSelectedCity("noida")}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                selectedCity === "noida"
                  ? "bg-white text-primary shadow-xs border border-slate-200"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Noida
            </button>
          </div>
        </div>

        {/* Vehicle Category Filter Pills */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Car size={13} /> Select Vehicle Type (Adjusts Pricing)
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {VEHICLE_CATEGORIES.map((vc) => (
              <button
                key={vc.id}
                type="button"
                onClick={() => setSelectedVehicleCategory(vc.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border",
                  selectedVehicleCategory === vc.id
                    ? "bg-primary text-white border-primary shadow-xs"
                    : "bg-white text-foreground border-slate-200 hover:border-primary/40 hover:bg-slate-50"
                )}
              >
                {vc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search services (e.g. foam wash, ceramic, interior)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Categories Tab Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all border",
                    active
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-muted-foreground border-slate-200 hover:text-foreground hover:bg-slate-50"
                  )}
                >
                  <Icon size={13} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Service Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomerSkeleton className="h-44 w-full rounded-2xl" />
            <CustomerSkeleton className="h-44 w-full rounded-2xl" />
            <CustomerSkeleton className="h-44 w-full rounded-2xl" />
            <CustomerSkeleton className="h-44 w-full rounded-2xl" />
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <h3 className="font-semibold text-sm text-foreground">No services found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search query or category filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            {filteredServices.map((svc) => {
              const multiplier =
                VEHICLE_CATEGORIES.find((v) => v.id === selectedVehicleCategory)?.multiplier || 1.0;
              const calculatedPrice = Math.round(svc.effectivePrice * (svc.serviceType === "solar_cleaning" ? 1.0 : multiplier));

              return (
                <CustomerCard
                  key={svc.id}
                  className="p-5 flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all duration-200 group relative bg-white"
                  data-testid={`service-catalog-card-${svc.slug}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wide">
                            {svc.category.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Available in {selectedCity === "varanasi" ? "Varanasi" : "Noida"}
                          </span>
                        </div>
                        <h3 className="font-display font-bold text-base text-foreground mt-1 group-hover:text-primary transition-colors">
                          {svc.name}
                        </h3>
                      </div>

                      {/* Duration badge */}
                      {svc.durationMinutes && (
                        <span className="text-[11px] font-medium text-muted-foreground bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                          <Clock size={12} /> {svc.durationMinutes}m
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {svc.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Applicable Price
                      </p>
                      <p className="font-display font-black text-xl text-foreground text-primary">
                        ₹{calculatedPrice.toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          {svc.serviceType === "daily_cleaning" ? "/mo" : "incl. GST"}
                        </span>
                      </p>
                    </div>

                    <CustomerButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleBookService(svc)}
                      className="gap-1.5 shadow-xs"
                      data-testid={`book-btn-${svc.slug}`}
                    >
                      Book Now <ArrowRight size={14} />
                    </CustomerButton>
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
