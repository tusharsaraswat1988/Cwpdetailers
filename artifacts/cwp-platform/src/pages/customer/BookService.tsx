import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useCreateBooking, getListBookingsQueryKey,
  useListVehicles, getListVehiclesQueryKey,
  useListSolarSites, getListSolarSitesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import { computeSolarCleaningPrice } from "@/lib/solar-pricing";
import {
  useCatalogServices, useSavedLocations, useCreateSavedLocation,
  usePricingQuote, type LocationValue, type SavedLocation,
} from "@/features/master-data/api";
import {
  useCatalogAddons, useCatalogPricingQuote, useSelfBookingCheck,
} from "@/features/service-catalog/api";
import { ServiceAddressRow } from "@/components/shared/ServiceAddressRow";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";
import { QuickAddAssetSheet } from "@/components/shared/QuickAddAssetSheet";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFormDraft } from "@/hooks/useFormDraft";
import { moduleError } from "@/lib/moduleErrors";
import { Loader2, CheckCircle, Car, Sun, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { cn } from "@/lib/utils";

type BookingStep = "service" | "asset" | "schedule";

const defaultBookingForm = {
  serviceId: "",
  serviceCategorySlug: "",
  scheduledDate: "",
  scheduledTime: "09:00",
  notes: "",
  vehicleId: "",
  solarSiteId: "",
};

type AssetWithLocation = {
  id: number;
  serviceAddress?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
  locationComplete?: boolean;
  address?: string | null;
};

function locationFromAsset(asset: AssetWithLocation | undefined): LocationValue | null {
  if (!asset) return null;
  const lat = asset.serviceLat;
  const lng = asset.serviceLng;
  const address = (asset.serviceAddress ?? asset.address ?? "").trim();
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || !address) {
    return null;
  }
  return { address, latitude: lat, longitude: lng, placeId: asset.placeId ?? undefined };
}

function locationFromSaved(loc: SavedLocation | undefined): LocationValue | null {
  if (!loc) return null;
  return {
    address: loc.address,
    latitude: loc.latitude,
    longitude: loc.longitude,
    placeId: loc.placeId,
  };
}

function BookingStepProgress({
  step,
  assetLabel,
}: {
  step: BookingStep;
  assetLabel: string;
}) {
  const steps: { id: BookingStep; label: string }[] = [
    { id: "service", label: "Service" },
    { id: "asset", label: assetLabel },
    { id: "schedule", label: "Schedule" },
  ];
  const activeIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="flex items-center gap-1.5" data-testid="booking-step-progress">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={s.id} className="flex items-center gap-1.5 min-w-0 flex-1">
            <div
              className={cn(
                "flex items-center gap-1.5 min-w-0 rounded-full px-2.5 py-1 text-xs font-medium border",
                active && "border-primary bg-primary/10 text-primary",
                done && "border-green-500/40 bg-green-500/10 text-green-800",
                !active && !done && "border-border text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0",
                  active && "bg-primary text-secondary",
                  done && "bg-green-600 text-white",
                  !active && !done && "bg-muted",
                )}
              >
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className="truncate">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px w-2 shrink-0", done ? "bg-green-500/50" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BookService() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<BookingStep>("service");
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [bookingLocation, setBookingLocation] = useState<LocationValue | null>(null);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { value: form, setValue: setForm, clearDraft, restoredFromDraft } = useFormDraft(
    "customer-booking-form",
    defaultBookingForm,
  );

  const { data: catalogServices, isLoading: servicesLoading, isError: servicesError, refetch: refetchServices } = useCatalogServices();
  const { data: vehicles } = useListVehicles({ customerId: customerId ?? 0 }, {
    query: { queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null },
  });
  const { data: solarSites } = useListSolarSites({ customerId: customerId ?? 0 }, {
    query: { queryKey: getListSolarSitesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null },
  });
  const { data: savedLocations } = useSavedLocations(customerId ?? undefined);
  const createSavedLoc = useCreateSavedLocation();

  const serviceCategories = useMemo(() => {
    const cats = new Map<string, { slug: string; name: string }>();
    for (const s of catalogServices ?? []) {
      const slug = s.categorySlug ?? s.category;
      if (!cats.has(slug)) cats.set(slug, { slug, name: s.categoryName ?? slug.replace(/-/g, " ") });
    }
    return Array.from(cats.values());
  }, [catalogServices]);

  const filteredServices = useMemo(() => {
    if (!form.serviceCategorySlug) return catalogServices ?? [];
    return (catalogServices ?? []).filter(s =>
      (s.categorySlug ?? s.category) === form.serviceCategorySlug ||
      s.category === form.serviceCategorySlug.replace(/-/g, "_"),
    );
  }, [catalogServices, form.serviceCategorySlug]);

  const selectedService = filteredServices.find(s => String(s.id) === form.serviceId);
  const selectedVehicle = (vehicles ?? []).find(v => String(v.id) === form.vehicleId) as AssetWithLocation | undefined;
  const selectedSolar = (solarSites ?? []).find(s => String(s.id) === form.solarSiteId) as
    | (AssetWithLocation & { panelCount?: number })
    | undefined;

  const isSolar = form.serviceCategorySlug === "solar-cleaning" || selectedService?.category === "solar_cleaning";
  const needsVehicle = !isSolar && form.serviceCategorySlug !== "";
  const needsSolar = isSolar;
  const assetLabel = isSolar ? "Site" : "Vehicle";

  const { data: pricingQuoteLegacy } = usePricingQuote(
    form.serviceId ? parseInt(form.serviceId) : undefined,
    (selectedVehicle as { vehicleModelId?: number } | undefined)?.vehicleModelId,
  );
  const { data: catalogQuote } = useCatalogPricingQuote({
    serviceId: form.serviceId ? parseInt(form.serviceId) : undefined,
    vehicleModelId: (selectedVehicle as { vehicleModelId?: number } | undefined)?.vehicleModelId,
    panelCount: selectedSolar?.panelCount,
    citySlug: "varanasi",
  });
  const pricingQuote = catalogQuote ?? pricingQuoteLegacy;

  const { data: serviceAddons } = useCatalogAddons(form.serviceId ? parseInt(form.serviceId) : undefined);
  const { data: selfBooking } = useSelfBookingCheck(
    customerId ?? undefined,
    form.serviceId ? parseInt(form.serviceId) : undefined,
  );

  const addonTotal = (serviceAddons ?? [])
    .filter(a => selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + Number(a.basePrice), 0);

  const estimatedPrice = useMemo(() => {
    if (selfBooking?.eligible) return addonTotal;
    let base: number | null = null;
    if (isSolar && selectedSolar?.panelCount != null) base = computeSolarCleaningPrice(selectedSolar.panelCount);
    else if (pricingQuote) base = Number((pricingQuote as { amount?: number }).amount ?? 0);
    else if (selectedService) base = Number(selectedService.basePrice);
    if (base == null) return null;
    return base + addonTotal;
  }, [isSolar, selectedSolar, pricingQuote, selectedService, addonTotal, selfBooking?.eligible]);

  const hasVehicle = (vehicles ?? []).length > 0;
  const hasSolar = (solarSites ?? []).length > 0;

  // Prefill from saved default once (unless user already chose / draft restored with location later)
  useEffect(() => {
    if (locationTouched || bookingLocation) return;
    const defaultSaved =
      savedLocations?.find(l => l.isDefault) ??
      (savedLocations?.length === 1 ? savedLocations[0] : undefined);
    const fromSaved = locationFromSaved(defaultSaved);
    if (fromSaved) setBookingLocation(fromSaved);
  }, [savedLocations, bookingLocation, locationTouched]);

  // Prefill / update from selected asset location when user hasn't manually set address via sheet
  useEffect(() => {
    if (locationTouched) return;
    const fromAsset = locationFromAsset(isSolar ? selectedSolar : selectedVehicle);
    if (fromAsset) setBookingLocation(fromAsset);
  }, [selectedVehicle, selectedSolar, isSolar, locationTouched]);

  const createMutation = useCreateBooking({
    mutation: {
      onSuccess: async () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        await clearDraft();
        setSuccess(true);
        toast({ title: "Booking confirmed!" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? moduleError("bookings", "save"), variant: "destructive" }),
    },
  });

  const today = new Date().toISOString().split("T")[0];

  const canContinueService = Boolean(form.serviceCategorySlug && (isSolar || form.serviceId));
  const canContinueAsset =
    (needsVehicle && form.vehicleId) ||
    (needsSolar && form.solarSiteId);
  const canSubmit =
    form.scheduledDate &&
    bookingLocation &&
    (!needsVehicle || form.vehicleId) &&
    (!needsSolar || form.solarSiteId) &&
    (!isSolar ? form.serviceId : true);

  const missingHint = !bookingLocation
    ? "Add where we should arrive"
    : !form.scheduledDate
      ? "Pick a date for the visit"
      : null;

  const resetBooking = () => {
    setSuccess(false);
    setForm(defaultBookingForm);
    setBookingLocation(null);
    setLocationTouched(false);
    setSelectedAddonIds([]);
    setStep("service");
  };

  const confirmBooking = () => {
    if (!bookingLocation || !customerId) return;
    const serviceType = isSolar ? "solar_cleaning" : (selectedService?.category ?? "car_wash");
    createMutation.mutate({
      data: {
        customerId,
        serviceId: form.serviceId ? parseInt(form.serviceId) : undefined,
        vehicleId: form.vehicleId ? parseInt(form.vehicleId) : undefined,
        solarSiteId: form.solarSiteId ? parseInt(form.solarSiteId) : undefined,
        serviceType: serviceType as "car_wash" | "detailing" | "solar_cleaning" | "pickup_drop",
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime,
        notes: form.notes || undefined,
        address: bookingLocation.address,
        locationLat: bookingLocation.latitude,
        locationLng: bookingLocation.longitude,
        placeId: bookingLocation.placeId,
        citySlug: "varanasi",
        addonIds: selectedAddonIds.length ? selectedAddonIds : undefined,
        entitlementId: selfBooking?.eligible ? selfBooking.entitlementId : undefined,
      } as Parameters<typeof createMutation.mutate>[0]["data"],
    });
  };

  if (scopeLoading) {
    return <CustomerLayout><div className="p-6"><Loader2 className="animate-spin" /></div></CustomerLayout>;
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="p-6 max-w-md mx-auto text-center space-y-2">
          <p className="font-semibold">Account not linked</p>
          <NoCustomerProfileMessage />
        </div>
      </CustomerLayout>
    );
  }

  if (success) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 mx-auto">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h2 className="font-display font-bold text-2xl mb-2">Booking Confirmed!</h2>
            <p className="text-muted-foreground mb-8">Our technician will reach you at the scheduled time.</p>
            <div className="flex flex-col gap-3">
              <Button onClick={resetBooking} className="w-full h-11 bg-primary text-secondary hover:bg-primary/90">
                Book Another Service
              </Button>
              <Link href="/customer/history"><Button variant="outline" className="w-full h-11">View My Bookings</Button></Link>
            </div>
          </motion.div>
        </div>
      </CustomerLayout>
    );
  }

  const stepTitle =
    step === "service"
      ? "What do you need?"
      : step === "asset"
        ? (isSolar ? "Which solar site?" : "Which car?")
        : "When should we come?";

  return (
    <CustomerLayout>
      <div
        className={cn(
          "max-w-lg mx-auto space-y-5",
          step === "schedule" && "pb-[calc(var(--bottom-nav-height)+5.5rem)]",
        )}
      >
        <div className="space-y-3">
          <div>
            <h1 className="font-display font-bold text-2xl">Book a Service</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{stepTitle}</p>
            {restoredFromDraft && (
              <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded-md px-3 py-2 inline-block">
                Restored your previous booking draft.
              </p>
            )}
          </div>
          <BookingStepProgress step={step} assetLabel={assetLabel} />
        </div>

        {step === "service" && (
          <div className="space-y-4" data-testid="booking-step-service">
            {servicesLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" /> Loading services…
              </div>
            )}

            {servicesError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-3">
                <p className="font-medium text-destructive">Couldn’t load services</p>
                <p className="text-muted-foreground">Check your connection and try again.</p>
                <Button size="sm" variant="outline" onClick={() => void refetchServices()}>
                  Retry
                </Button>
              </div>
            )}

            {!servicesLoading && !servicesError && serviceCategories.length === 0 && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                No bookable services are available yet. Please check back soon or contact support.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {serviceCategories.map(cat => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => {
                    setForm(f => ({
                      ...f,
                      serviceCategorySlug: cat.slug,
                      serviceId: "",
                      vehicleId: "",
                      solarSiteId: "",
                    }));
                    setSelectedAddonIds([]);
                  }}
                  data-testid={`type-${cat.slug}`}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    form.serviceCategorySlug === cat.slug
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {cat.slug.includes("solar")
                      ? <Sun size={14} className="text-primary" />
                      : <Car size={14} className="text-primary" />}
                    <span className="font-medium text-sm capitalize">{cat.name}</span>
                  </div>
                </button>
              ))}
            </div>

            {form.serviceCategorySlug && !isSolar && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Choose a service</p>
                {filteredServices.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, serviceId: String(s.id) }))}
                    data-testid={`service-card-${s.id}`}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-all",
                      form.serviceId === String(s.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{s.name}</p>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-primary shrink-0">
                        from ₹{Number(s.basePrice).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </button>
                ))}
                {filteredServices.length === 0 && (
                  <p className="text-sm text-muted-foreground">No services in this category yet.</p>
                )}
              </div>
            )}

            {isSolar && form.serviceCategorySlug && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Solar cleaning price is based on your site&apos;s panel count. Continue to pick your site.
              </div>
            )}

            <Button
              className="w-full h-11"
              disabled={!canContinueService}
              onClick={() => setStep("asset")}
              data-testid="btn-booking-continue-service"
            >
              Continue <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
        )}

        {step === "asset" && (
          <div className="space-y-4" data-testid="booking-step-asset">
            {needsVehicle && !hasVehicle && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
                <p className="font-medium text-amber-800">Add your first vehicle</p>
                <p className="text-muted-foreground mt-1">Takes less than a minute — you won't lose your booking progress.</p>
                <Button size="sm" className="gap-1 mt-3" onClick={() => setQuickAddOpen(true)} data-testid="btn-quickadd-open-vehicle">
                  Add vehicle <ArrowRight size={12} />
                </Button>
              </div>
            )}

            {needsSolar && !hasSolar && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
                <p className="font-medium text-amber-800">Add your first solar site</p>
                <p className="text-muted-foreground mt-1">Takes less than a minute — you won't lose your booking progress.</p>
                <Button size="sm" className="gap-1 mt-3" onClick={() => setQuickAddOpen(true)} data-testid="btn-quickadd-open-solar">
                  Add solar site <ArrowRight size={12} />
                </Button>
              </div>
            )}

            {needsVehicle && hasVehicle && (
              <div className="space-y-2">
                {(vehicles ?? []).map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, vehicleId: String(v.id) }));
                      setLocationTouched(false);
                    }}
                    data-testid={`vehicle-card-${v.id}`}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-all",
                      form.vehicleId === String(v.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <p className="font-medium text-sm">{v.make} {v.model}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.registrationNumber}</p>
                    {(v as AssetWithLocation).locationComplete ? (
                      <p className="text-xs text-green-700 mt-1">Location saved</p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-1">You can set address on the next step</p>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="w-full rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  data-testid="btn-quickadd-another-vehicle"
                >
                  + Add another vehicle
                </button>
              </div>
            )}

            {needsSolar && hasSolar && (
              <div className="space-y-2">
                {(solarSites ?? []).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, solarSiteId: String(s.id) }));
                      setLocationTouched(false);
                    }}
                    data-testid={`solar-card-${s.id}`}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-all",
                      form.solarSiteId === String(s.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <p className="font-medium text-sm">{s.address}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.panelCount} panels</p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="w-full rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  data-testid="btn-quickadd-another-solar"
                >
                  + Add another solar site
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setStep("service")}
                data-testid="btn-booking-back-asset"
              >
                <ArrowLeft size={16} className="mr-1" /> Back
              </Button>
              <Button
                className="flex-1 h-11"
                disabled={!canContinueAsset}
                onClick={() => setStep("schedule")}
                data-testid="btn-booking-continue-asset"
              >
                Continue <ArrowRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "schedule" && (
          <div className="space-y-4" data-testid="booking-step-schedule">
            <ServiceAddressRow
              value={bookingLocation}
              onChangeClick={() => setAddressSheetOpen(true)}
            />

            {selfBooking?.eligible && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
                <p className="font-medium text-green-800">Package visit available</p>
                <p className="text-muted-foreground">
                  {selfBooking.remainingCredits} credits left
                </p>
              </div>
            )}

            {(serviceAddons ?? []).length > 0 && (
              <div>
                <Label>Add-ons (optional)</Label>
                <div className="mt-2 space-y-2">
                  {(serviceAddons ?? []).map(addon => (
                    <label key={addon.id} className="flex items-center gap-2 text-sm border rounded-lg p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAddonIds.includes(addon.id)}
                        onChange={e => setSelectedAddonIds(ids =>
                          e.target.checked ? [...ids, addon.id] : ids.filter(x => x !== addon.id),
                        )}
                      />
                      <span className="flex-1">{addon.name}</span>
                      <span className="font-medium">₹{addon.basePrice}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  min={today}
                  value={form.scheduledDate}
                  onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  className="mt-1"
                  data-testid="input-date"
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={form.scheduledTime}
                  onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                  className="mt-1"
                  data-testid="input-time"
                />
              </div>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Gate code, parking tip, etc."
                className="mt-1"
                data-testid="input-notes"
              />
            </div>

            {estimatedPrice != null && (
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated price</span>
                  <span className="font-semibold text-primary" data-testid="estimated-price">
                    ₹{estimatedPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                {pricingQuote && (pricingQuote as { vehicleCategory?: string }).vehicleCategory && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on {(pricingQuote as { vehicleCategory?: string }).vehicleCategory}
                    {(pricingQuote as { seatCategory?: string }).seatCategory
                      ? ` · ${(pricingQuote as { seatCategory?: string }).seatCategory}`
                      : ""}
                  </p>
                )}
                {selfBooking?.eligible && (
                  <p className="text-xs text-green-700 mt-1">Service covered by your active package</p>
                )}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              onClick={() => setStep("asset")}
              data-testid="btn-booking-back-schedule"
            >
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
          </div>
        )}
      </div>

      {step === "schedule" && (
        <div className="fixed inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 bottom-[var(--bottom-nav-height)]">
          <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
            {missingHint && (
              <p className="text-xs text-amber-700 text-center" data-testid="booking-missing-hint">
                {missingHint}
              </p>
            )}
            <div className="flex items-center gap-3">
              {estimatedPrice != null && (
                <div className="shrink-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="font-semibold text-primary">₹{estimatedPrice.toLocaleString("en-IN")}</p>
                </div>
              )}
              <Button
                data-testid="btn-confirm-booking"
                disabled={!canSubmit || createMutation.isPending}
                onClick={confirmBooking}
                className="flex-1 h-12 bg-primary text-secondary hover:bg-primary/90 font-semibold"
              >
                {createMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin mr-2" />Booking...</>
                  : "Confirm booking"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <QuickAddAssetSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        customerId={customerId!}
        kind={isSolar ? "solar" : "vehicle"}
        onCreated={(id) => {
          setLocationTouched(false);
          if (isSolar) setForm(f => ({ ...f, solarSiteId: String(id) }));
          else setForm(f => ({ ...f, vehicleId: String(id) }));
        }}
      />

      <AddressPickerSheet
        open={addressSheetOpen}
        onOpenChange={setAddressSheetOpen}
        value={bookingLocation}
        savedLocations={savedLocations}
        onSelect={loc => {
          setBookingLocation(loc);
          setLocationTouched(true);
        }}
        onSaveNew={(label, loc) => createSavedLoc.mutate({
          customerId: customerId!,
          label,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          placeId: loc.placeId,
          isDefault: false,
        })}
      />
    </CustomerLayout>
  );
}
