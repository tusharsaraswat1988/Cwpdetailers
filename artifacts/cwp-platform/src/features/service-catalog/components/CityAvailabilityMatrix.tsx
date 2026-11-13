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
  Eye,
  SlidersHorizontal,
  Building2,
  Calendar,
} from "lucide-react";

type City = {
  id: number;
  name: string;
  slug: string;
  stateName?: string;
  isActive: boolean;
};

type Branch = {
  id: number;
  cityId: number;
  name: string;
  code?: string;
  isActive?: boolean;
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
  branchId?: number | null;
  basePriceOverride?: string | number | null;
  bookingModes?: string[];
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  adminNotes?: string | null;
  isActive: boolean;
};

type PreviewServiceItem = {
  id: number;
  name: string;
  category: string;
  effectivePrice: number;
  globalBasePrice: number;
  cityPriceOverride: number | null;
  branchPriceOverride: number | null;
  isAvailable: boolean;
  bookingModes: string[];
  source: string;
};

const CITIES_KEY = ["masters", "cities"];
const BRANCHES_KEY = ["/api/branches"];
const SERVICES_KEY = ["catalog", "services-all"];
const CITY_AVAILABILITY_KEY = ["catalog", "city-availability"];
const MATRIX_KEY = ["catalog", "matrix"];

export function CityAvailabilityMatrix() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("all");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");

  // State for Customer Catalog Preview Dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCityId, setPreviewCityId] = useState<string>("");
  const [previewBranchId, setPreviewBranchId] = useState<string>("");

  // State for Confirm Disable Dialog
  const [confirmDisable, setConfirmDisable] = useState<{
    service: ServiceItem;
    city: City;
  } | null>(null);

  // State for Advanced Availability & Price Dialog
  const [configTarget, setConfigTarget] = useState<{
    service: ServiceItem;
    city: City;
    branchId?: number | null;
    record?: CityAvailabilityRecord;
  } | null>(null);

  const [configForm, setConfigForm] = useState<{
    basePriceOverride: string;
    bookingModes: string[];
    effectiveFrom: string;
    effectiveUntil: string;
    adminNotes: string;
  }>({
    basePriceOverride: "",
    bookingModes: ["one_time"],
    effectiveFrom: "",
    effectiveUntil: "",
    adminNotes: "",
  });

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

  // 2. Fetch Branches
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: BRANCHES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 3. Fetch All Services
  const { data: services = [], isLoading: servicesLoading } = useQuery<ServiceItem[]>({
    queryKey: SERVICES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/services?includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load services");
      return res.json();
    },
  });

  // 4. Fetch Matrix Records
  const { data: availabilityRecords = [], isLoading: availabilityLoading } = useQuery<CityAvailabilityRecord[]>({
    queryKey: MATRIX_KEY,
    queryFn: async () => {
      const res = await fetch("/api/catalog/matrix?includeInactive=true", { credentials: "include" });
      if (!res.ok) {
        // Fallback to legacy endpoint if needed
        const fallback = await fetch("/api/catalog/city-availability", { credentials: "include" });
        if (!fallback.ok) return [];
        return fallback.json();
      }
      return res.json();
    },
  });

  // Preview query
  const { data: previewServices = [], isLoading: previewLoading } = useQuery<PreviewServiceItem[]>({
    queryKey: ["catalog", "preview", previewCityId, previewBranchId],
    queryFn: async () => {
      if (!previewCityId) return [];
      const qs = new URLSearchParams({ cityId: previewCityId });
      if (previewBranchId && previewBranchId !== "all") qs.append("branchId", previewBranchId);
      const res = await fetch(`/api/catalog/preview?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: previewOpen && Boolean(previewCityId),
  });

  // Build availability lookup map
  const availabilityMap = useMemo(() => {
    const map = new Map<string, CityAvailabilityRecord>();
    for (const record of availabilityRecords) {
      if (record.branchId) {
        map.set(`${record.serviceId}-${record.cityId}-b${record.branchId}`, record);
      } else {
        map.set(`${record.serviceId}-${record.cityId}`, record);
      }
    }
    return map;
  }, [availabilityRecords]);

  // Mutation to update availability in Matrix
  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({
      serviceId,
      cityId,
      branchId,
      isActive,
      basePriceOverride,
      bookingModes,
      effectiveFrom,
      effectiveUntil,
      adminNotes,
    }: {
      serviceId: number;
      cityId: number;
      branchId?: number | null;
      isActive: boolean;
      basePriceOverride?: number | null;
      bookingModes?: string[];
      effectiveFrom?: string | null;
      effectiveUntil?: string | null;
      adminNotes?: string | null;
    }) => {
      const cellKey = branchId ? `${serviceId}-${cityId}-b${branchId}` : `${serviceId}-${cityId}`;
      setPendingCells(p => ({ ...p, [cellKey]: true }));

      const payload: Record<string, unknown> = {
        serviceId,
        cityId,
        branchId: branchId ?? null,
        isActive,
      };
      if (basePriceOverride !== undefined) payload.basePriceOverride = basePriceOverride;
      if (bookingModes !== undefined) payload.bookingModes = bookingModes;
      if (effectiveFrom) payload.effectiveFrom = effectiveFrom;
      if (effectiveUntil !== undefined) payload.effectiveUntil = effectiveUntil;
      if (adminNotes !== undefined) payload.adminNotes = adminNotes;

      const res = await fetch("/api/catalog/matrix", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update service availability matrix");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: MATRIX_KEY });
      qc.invalidateQueries({ queryKey: CITY_AVAILABILITY_KEY });
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["catalog", "preview"] });
      const cellKey = variables.branchId
        ? `${variables.serviceId}-${variables.cityId}-b${variables.branchId}`
        : `${variables.serviceId}-${variables.cityId}`;
      setPendingCells(p => {
        const next = { ...p };
        delete next[cellKey];
        return next;
      });

      toast({
        title: variables.isActive ? "Service Enabled in Scope" : "Service Disabled in Scope",
        description: `Availability configuration updated and live across all customer portals.`,
      });
    },
    onError: (err: Error, variables) => {
      const cellKey = variables.branchId
        ? `${variables.serviceId}-${variables.cityId}-b${variables.branchId}`
        : `${variables.serviceId}-${variables.cityId}`;
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
      setConfirmDisable({ service, city });
    } else {
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

  const handleOpenConfig = (service: ServiceItem, city: City, record?: CityAvailabilityRecord) => {
    setConfigTarget({ service, city, record });
    setConfigForm({
      basePriceOverride: record?.basePriceOverride != null ? String(record.basePriceOverride) : "",
      bookingModes: record?.bookingModes && Array.isArray(record.bookingModes) ? record.bookingModes : ["one_time"],
      effectiveFrom: record?.effectiveFrom ? new Date(record.effectiveFrom).toISOString().slice(0, 10) : "",
      effectiveUntil: record?.effectiveUntil ? new Date(record.effectiveUntil).toISOString().slice(0, 10) : "",
      adminNotes: record?.adminNotes ?? "",
    });
  };

  const handleSaveConfig = () => {
    if (!configTarget) return;
    const val = configForm.basePriceOverride.trim() ? parseFloat(configForm.basePriceOverride) : null;
    const isActive = configTarget.record ? configTarget.record.isActive : true;

    updateAvailabilityMutation.mutate({
      serviceId: configTarget.service.id,
      cityId: configTarget.city.id,
      branchId: configTarget.branchId ?? null,
      isActive,
      basePriceOverride: val,
      bookingModes: configForm.bookingModes,
      effectiveFrom: configForm.effectiveFrom || null,
      effectiveUntil: configForm.effectiveUntil || null,
      adminNotes: configForm.adminNotes.trim() || null,
    });
    setConfigTarget(null);
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
            Universal City/Branch Service Availability Matrix
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Single source of truth for service catalog visibility, booking modes, and price overrides across all cities and branches.
          </p>
        </div>

        {/* Customer Catalog Preview Button */}
        <Button
          variant="outline"
          className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/5"
          onClick={() => {
            if (cities[0]) setPreviewCityId(String(cities[0].id));
            setPreviewOpen(true);
          }}
          data-testid="preview-customer-catalog-btn"
        >
          <Eye size={16} />
          Customer Catalog Preview
        </Button>
      </div>

      {/* Info notice about zero code deployment */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5">
        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Configuration-Driven Multi-City Architecture</p>
          <p className="text-muted-foreground dark:text-emerald-300">
            Changes are immediate and enforced deterministically on the backend. For example, Noida can offer exclusively Daily Car Cleaning while Varanasi offers the complete catalog without code modifications.
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
                    <th key={city.id} className="p-3.5 min-w-[200px] text-center border-l border-border/60">
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
                              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                {hasOverride ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConfig(service, city, record)}
                                    className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
                                    title="Click to edit city configuration"
                                  >
                                    <Tag size={10} />
                                    ₹{Number(record?.basePriceOverride).toLocaleString("en-IN")}
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => handleOpenConfig(service, city, record)}
                                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors underline decoration-dotted"
                                  title="Configure booking modes, pricing and dates"
                                >
                                  <SlidersHorizontal size={10} />
                                  {hasOverride ? "Settings" : "+ Override"}
                                </button>
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
                Customers in {confirmDisable?.city.name} will no longer see this service on the portal or app, and new booking requests will be rejected by the backend city validator with <code>SERVICE_UNAVAILABLE_IN_SCOPE</code>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDisable}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Disable Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Advanced Scope Availability & Price Dialog */}
      <Dialog open={Boolean(configTarget)} onOpenChange={open => !open && setConfigTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-primary" />
              Configure Service Availability & Pricing
            </DialogTitle>
            <DialogDescription>
              {configTarget?.service.name} in {configTarget?.city.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Base Price Override (₹)</Label>
              <Input
                type="number"
                placeholder={`Global default: ₹${configTarget?.service.basePrice || 0}`}
                value={configForm.basePriceOverride}
                onChange={e => setConfigForm(f => ({ ...f, basePriceOverride: e.target.value }))}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Leave empty to inherit the global catalog base price.
              </p>
            </div>

            <div>
              <Label className="text-xs">Allowed Booking Modes</Label>
              <div className="flex gap-4 mt-1.5 text-xs">
                {["one_time", "subscription", "package"].map(mode => (
                  <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configForm.bookingModes.includes(mode)}
                      onChange={e => {
                        const checked = e.target.checked;
                        setConfigForm(f => ({
                          ...f,
                          bookingModes: checked
                            ? [...f.bookingModes, mode]
                            : f.bookingModes.filter(m => m !== mode),
                        }));
                      }}
                      className="rounded border-border"
                    />
                    <span className="capitalize">{mode.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Effective From (Launch Date)</Label>
                <Input
                  type="date"
                  value={configForm.effectiveFrom}
                  onChange={e => setConfigForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Effective Until (Sunset Date)</Label>
                <Input
                  type="date"
                  value={configForm.effectiveUntil}
                  onChange={e => setConfigForm(f => ({ ...f, effectiveUntil: e.target.value }))}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Admin Notes</Label>
              <Input
                placeholder="e.g. Launched for Diwali promotion / Sector 62 pilot"
                value={configForm.adminNotes}
                onChange={e => setConfigForm(f => ({ ...f, adminNotes: e.target.value }))}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigTarget(null)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={updateAvailabilityMutation.isPending}>
              Save Scope Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Catalog Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} className="text-primary" />
              Customer Catalog Simulation Preview
            </DialogTitle>
            <DialogDescription>
              Preview exactly what customers in a selected city and branch see when browsing the service catalog.
            </DialogDescription>
          </DialogHeader>

          {/* Scope Selectors */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold">City:</Label>
              <select
                value={previewCityId}
                onChange={e => setPreviewCityId(e.target.value)}
                className="text-xs bg-background border border-border rounded px-2.5 py-1.5 font-medium"
              >
                {cities.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold">Branch:</Label>
              <select
                value={previewBranchId}
                onChange={e => setPreviewBranchId(e.target.value)}
                className="text-xs bg-background border border-border rounded px-2.5 py-1.5 font-medium"
              >
                <option value="all">All Branches (City Default)</option>
                {branches
                  .filter(b => !previewCityId || String(b.cityId) === previewCityId)
                  .map(b => (
                    <option key={b.id} value={String(b.id)}>{b.name}</option>
                  ))}
              </select>
            </div>

            <Badge variant="outline" className="ml-auto text-xs">
              {previewServices.filter(s => s.isAvailable).length} Available Services
            </Badge>
          </div>

          {/* Services List Preview */}
          <div className="space-y-3 mt-3">
            {previewLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : previewServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No services configured for this scope.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {previewServices.map(svc => (
                  <div
                    key={svc.id}
                    className={`rounded-lg border p-3 flex flex-col justify-between ${
                      svc.isAvailable ? "border-emerald-500/30 bg-card" : "border-border/60 bg-muted/30 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{svc.name}</span>
                        {svc.isAvailable ? (
                          <Badge className="bg-emerald-600 text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Unavailable</Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider block mt-0.5">
                        {svc.category}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-muted-foreground text-[10px] block">Customer Price</span>
                        <span className="font-mono font-bold text-sm">₹{svc.effectivePrice}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">Source</span>
                        <span className="text-[10px] font-mono capitalize">{svc.source.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
