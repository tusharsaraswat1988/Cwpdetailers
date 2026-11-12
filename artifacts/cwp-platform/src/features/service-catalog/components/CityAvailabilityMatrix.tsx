import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  MapPin,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Tag,
  DollarSign,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";

type City = {
  id: number;
  name: string;
  slug: string;
  stateName?: string;
  isActive: boolean;
};

type ServiceItem = {
  id: number;
  name: string;
  slug: string;
  category: string;
  basePrice: string | number;
  isActive: boolean;
};

type CityAvailabilityRecord = {
  id: number;
  serviceId: number;
  cityId: number;
  basePriceOverride?: string | number | null;
  isActive: boolean;
};

const CITIES_KEY = ["masters", "cities"];
const SERVICES_KEY = ["catalog", "services-all"];
const CITY_AVAILABILITY_KEY = ["catalog", "city-availability"];

export function CityAvailabilityMatrix() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("all");

  // State for Confirm Disable Dialog
  const [confirmDisable, setConfirmDisable] = useState<{
    service: ServiceItem;
    city: City;
  } | null>(null);

  // State for Price Override Dialog
  const [priceOverrideTarget, setPriceOverrideTarget] = useState<{
    service: ServiceItem;
    city: City;
    currentOverride: string;
  } | null>(null);
  const [overrideInput, setOverrideInput] = useState<string>("");

  // Track cell-level pending mutations
  const [pendingCells, setPendingCells] = useState<Record<string, boolean>>({});

  // 1. Fetch Active Cities
  const { data: cities = [], isLoading: citiesLoading } = useQuery<City[]>({
    queryKey: CITIES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/masters/cities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load cities");
      const list = await res.json();
      return list.filter((c: City) => c.isActive);
    },
  });

  // 2. Fetch All Services
  const { data: services = [], isLoading: servicesLoading } = useQuery<ServiceItem[]>({
    queryKey: SERVICES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/services?includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load services");
      return res.json();
    },
  });

  // 3. Fetch City Availability Records
  const { data: availabilityRecords = [], isLoading: availabilityLoading } = useQuery<CityAvailabilityRecord[]>({
    queryKey: CITY_AVAILABILITY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/catalog/city-availability", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load city availability");
      return res.json();
    },
  });

  // Build availability lookup map: "serviceId-cityId" -> CityAvailabilityRecord
  const availabilityMap = useMemo(() => {
    const map = new Map<string, CityAvailabilityRecord>();
    for (const record of availabilityRecords) {
      map.set(`${record.serviceId}-${record.cityId}`, record);
    }
    return map;
  }, [availabilityRecords]);

  // Mutation to toggle availability or set price override
  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({
      serviceId,
      cityId,
      isActive,
      basePriceOverride,
    }: {
      serviceId: number;
      cityId: number;
      isActive: boolean;
      basePriceOverride?: number | null;
    }) => {
      const cellKey = `${serviceId}-${cityId}`;
      setPendingCells(p => ({ ...p, [cellKey]: true }));

      const payload: Record<string, unknown> = {
        serviceId,
        cityId,
        isActive,
      };
      if (basePriceOverride !== undefined) {
        payload.basePriceOverride = basePriceOverride;
      }

      const res = await fetch("/api/catalog/city-availability", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update city service availability");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: CITY_AVAILABILITY_KEY });
      // Invalidate customer discovery caches as well
      qc.invalidateQueries({ queryKey: ["services"] });
      const cellKey = `${variables.serviceId}-${variables.cityId}`;
      setPendingCells(p => {
        const next = { ...p };
        delete next[cellKey];
        return next;
      });

      toast({
        title: variables.isActive ? "Service Enabled in City" : "Service Disabled in City",
        description: `Changes are active immediately in customer discovery and booking validation.`,
      });
    },
    onError: (err: Error, variables) => {
      const cellKey = `${variables.serviceId}-${variables.cityId}`;
      setPendingCells(p => {
        const next = { ...p };
        delete next[cellKey];
        return next;
      });
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleToggle = (service: ServiceItem, city: City, currentActive: boolean) => {
    if (currentActive) {
      // Disabling an active service requires confirmation to prevent accidental outages
      setConfirmDisable({ service, city });
    } else {
      // Enabling can proceed directly
      updateAvailabilityMutation.mutate({
        serviceId: service.id,
        cityId: city.id,
        isActive: true,
      });
    }
  };

  const executeDisable = () => {
    if (!confirmDisable) return;
    const { service, city } = confirmDisable;
    updateAvailabilityMutation.mutate({
      serviceId: service.id,
      cityId: city.id,
      isActive: false,
    });
    setConfirmDisable(null);
  };

  const handleOpenPriceOverride = (service: ServiceItem, city: City, currentOverride: string | number | null | undefined) => {
    setPriceOverrideTarget({
      service,
      city,
      currentOverride: currentOverride != null ? String(currentOverride) : "",
    });
    setOverrideInput(currentOverride != null ? String(currentOverride) : "");
  };

  const handleSavePriceOverride = () => {
    if (!priceOverrideTarget) return;
    const val = overrideInput.trim() ? parseFloat(overrideInput) : null;
    const currentRecord = availabilityMap.get(`${priceOverrideTarget.service.id}-${priceOverrideTarget.city.id}`);
    const isActive = currentRecord ? currentRecord.isActive : true;

    updateAvailabilityMutation.mutate({
      serviceId: priceOverrideTarget.service.id,
      cityId: priceOverrideTarget.city.id,
      isActive,
      basePriceOverride: val,
    });
    setPriceOverrideTarget(null);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set).sort();
  }, [services]);

  // Filtered Cities to show as columns
  const visibleCities = useMemo(() => {
    if (selectedCityFilter === "all") return cities;
    return cities.filter(c => String(c.id) === selectedCityFilter);
  }, [cities, selectedCityFilter]);

  // Filtered Services to show as rows
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      if (selectedCategory !== "all" && service.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = service.name.toLowerCase().includes(q);
        const matchesSlug = service.slug.toLowerCase().includes(q);
        const matchesCat = (service.category || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesCat) return false;
      }
      return true;
    });
  }, [services, selectedCategory, searchQuery]);

  const isLoading = citiesLoading || servicesLoading || availabilityLoading;

  return (
    <div className="space-y-6" data-testid="city-availability-matrix">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="text-primary" size={22} />
            City-Wise Service Availability Matrix
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure which services are available in each city. The backend strictly enforces this matrix during customer discovery and checkout.
          </p>
        </div>
      </div>

      {/* Info notice about zero code deployment */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Dynamic Configuration Without Code Deployments</p>
          <p className="text-muted-foreground dark:text-emerald-300">
            Enabling or disabling services takes effect instantly across the customer booking engine and mobile portals. For Noida launch, only Daily Car Cleaning should remain active, while Varanasi supports the full catalog.
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search service name, category or slug..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border">
            <span className="text-xs font-medium text-muted-foreground px-2">Category:</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Categories ({services.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* City Column Filter */}
          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border">
            <span className="text-xs font-medium text-muted-foreground px-2">City:</span>
            <select
              value={selectedCityFilter}
              onChange={e => setSelectedCityFilter(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Cities ({cities.length})</option>
              {cities.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Availability Matrix Grid */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : visibleCities.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>No active cities found. Create active cities in Master Data first.</p>
        </Card>
      ) : filteredServices.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>No services match the selected filter criteria.</p>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/70 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-3.5 min-w-[280px]">Service & Category</th>
                  <th className="p-3.5 min-w-[110px]">Base Price</th>
                  {visibleCities.map(city => (
                    <th key={city.id} className="p-3.5 min-w-[180px] text-center border-l border-border/60">
                      <div className="flex items-center justify-center gap-1.5 font-bold text-foreground">
                        <MapPin size={13} className="text-primary" />
                        <span>{city.name}</span>
                      </div>
                      {city.stateName && (
                        <span className="block text-[10px] font-normal text-muted-foreground normal-case">
                          {city.stateName}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {filteredServices.map(service => {
                  return (
                    <tr key={service.id} className="hover:bg-muted/20 transition-colors">
                      {/* Service info */}
                      <td className="p-3.5">
                        <div className="flex items-start gap-2">
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              {service.name}
                              {!service.isActive && (
                                <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
                                  Catalog Inactive
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                              <span className="capitalize">{service.category?.replace(/_/g, " ") || "General"}</span>
                              <span>•</span>
                              <span>slug: {service.slug}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Base price */}
                      <td className="p-3.5 text-xs font-medium font-mono text-muted-foreground">
                        ₹{Number(service.basePrice || 0).toLocaleString("en-IN")}
                      </td>

                      {/* City Columns */}
                      {visibleCities.map(city => {
                        const cellKey = `${service.id}-${city.id}`;
                        const record = availabilityMap.get(cellKey);
                        const isAvailable = record ? record.isActive : false;
                        const hasOverride = record?.basePriceOverride != null && record.basePriceOverride !== "";
                        const isPending = Boolean(pendingCells[cellKey]);

                        return (
                          <td
                            key={city.id}
                            className={`p-3.5 text-center border-l border-border/60 transition-colors ${
                              isAvailable ? "bg-emerald-500/5 dark:bg-emerald-500/10" : "bg-muted/10"
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              {/* Toggle switch */}
                              <div className="flex items-center gap-2">
                                {isPending ? (
                                  <Loader2 size={16} className="animate-spin text-primary" />
                                ) : (
                                  <Switch
                                    checked={isAvailable}
                                    onCheckedChange={() => handleToggle(service, city, isAvailable)}
                                    aria-label={`Toggle ${service.name} in ${city.name}`}
                                    className="data-[state=checked]:bg-emerald-600"
                                  />
                                )}
                                <span className={`text-xs font-semibold ${isAvailable ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                  {isAvailable ? "Active" : "Disabled"}
                                </span>
                              </div>

                              {/* Price Override Badge & Action */}
                              <div className="flex items-center gap-1">
                                {hasOverride ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPriceOverride(service, city, record?.basePriceOverride)}
                                    className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
                                    title="Click to edit city price override"
                                  >
                                    <Tag size={10} />
                                    ₹{Number(record?.basePriceOverride).toLocaleString("en-IN")}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPriceOverride(service, city, null)}
                                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline decoration-dotted"
                                    title="Set a city-specific price override"
                                  >
                                    + Price Override
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Disabling a Service */}
      <AlertDialog open={Boolean(confirmDisable)} onOpenChange={open => !open && setConfirmDisable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} />
              Disable Service in {confirmDisable?.city.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to disable <strong>{confirmDisable?.service.name}</strong> for <strong>{confirmDisable?.city.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground">
                Customers in {confirmDisable?.city.name} will no longer see this service on the portal or app, and new booking requests will be rejected by the backend city validator with <code>SERVICE_UNAVAILABLE_IN_CITY</code>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDisable}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Confirm Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Price Override Dialog */}
      <Dialog open={Boolean(priceOverrideTarget)} onOpenChange={open => !open && setPriceOverrideTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="text-primary" size={18} />
              City Price Override
            </DialogTitle>
            <DialogDescription>
              Set a city-specific price for <strong>{priceOverrideTarget?.service.name}</strong> in <strong>{priceOverrideTarget?.city.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="text-xs text-muted-foreground">
              Standard Catalog Base Price: <strong className="font-mono text-foreground">₹{Number(priceOverrideTarget?.service.basePrice || 0).toLocaleString("en-IN")}</strong>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">
                City Override Price (₹)
              </label>
              <Input
                type="number"
                step="1"
                min="0"
                value={overrideInput}
                onChange={e => setOverrideInput(e.target.value)}
                placeholder="Leave blank to use standard catalog price"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave empty to remove the override and inherit the base price.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceOverrideTarget(null)}>Cancel</Button>
            <Button onClick={handleSavePriceOverride}>
              Save Price Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
