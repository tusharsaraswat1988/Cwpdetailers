import { useMemo, useState } from "react";
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
  usePricingQuote, type LocationValue,
} from "@/features/master-data/api";
import {
  useCatalogAddons, useCatalogPricingQuote, useSelfBookingCheck,
} from "@/features/service-catalog/api";
import { LocationPicker } from "@/components/shared/LocationPicker";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFormDraft } from "@/hooks/useFormDraft";
import { moduleError } from "@/lib/moduleErrors";
import { Loader2, CheckCircle, Car, Sun, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";

const defaultBookingForm = {
  serviceId: "",
  serviceCategorySlug: "",
  scheduledDate: "",
  scheduledTime: "09:00",
  notes: "",
  vehicleId: "",
  solarSiteId: "",
};

export default function BookService() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [success, setSuccess] = useState(false);
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [bookingLocation, setBookingLocation] = useState<LocationValue | null>(null);
  const { value: form, setValue: setForm, clearDraft, restoredFromDraft } = useFormDraft(
    "customer-booking-form",
    defaultBookingForm,
  );

  const { data: catalogServices } = useCatalogServices();
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
  const selectedVehicle = (vehicles ?? []).find(v => String(v.id) === form.vehicleId);
  const selectedSolar = (solarSites ?? []).find(s => String(s.id) === form.solarSiteId);

  const isSolar = form.serviceCategorySlug === "solar-cleaning" || selectedService?.category === "solar_cleaning";
  const needsVehicle = !isSolar && form.serviceCategorySlug !== "";
  const needsSolar = isSolar;

  const { data: pricingQuoteLegacy } = usePricingQuote(
    form.serviceId ? parseInt(form.serviceId) : undefined,
    (selectedVehicle as { vehicleModelId?: number })?.vehicleModelId,
  );
  const { data: catalogQuote } = useCatalogPricingQuote({
    serviceId: form.serviceId ? parseInt(form.serviceId) : undefined,
    vehicleModelId: (selectedVehicle as { vehicleModelId?: number })?.vehicleModelId,
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
    if (isSolar && selectedSolar) base = computeSolarCleaningPrice(selectedSolar.panelCount);
    else if (pricingQuote) base = Number((pricingQuote as { amount?: number }).amount ?? 0);
    else if (selectedService) base = Number(selectedService.basePrice);
    if (base == null) return null;
    return base + addonTotal;
  }, [isSolar, selectedSolar, pricingQuote, selectedService, addonTotal, selfBooking?.eligible]);

  const hasVehicle = (vehicles ?? []).length > 0;
  const hasSolar = (solarSites ?? []).length > 0;

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

  const canSubmit =
    form.scheduledDate &&
    bookingLocation &&
    (!needsVehicle || form.vehicleId) &&
    (!needsSolar || form.solarSiteId) &&
    (!isSolar ? form.serviceId : true);

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
              <Button onClick={() => { setSuccess(false); setForm(defaultBookingForm); setBookingLocation(null); }} className="w-full h-11 bg-primary text-secondary hover:bg-primary/90">
                Book Another Service
              </Button>
              <Link href="/customer/history"><Button variant="outline" className="w-full h-11">View My Bookings</Button></Link>
            </div>
          </motion.div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Book a Service</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Schedule doorstep car wash, detailing, or solar cleaning.</p>
          {restoredFromDraft && <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded-md px-3 py-2 inline-block">Restored your previous booking draft.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {serviceCategories.map(cat => (
            <button key={cat.slug}
              onClick={() => setForm(f => ({ ...f, serviceCategorySlug: cat.slug, serviceId: "", vehicleId: "", solarSiteId: "" }))}
              data-testid={`type-${cat.slug}`}
              className={`p-4 rounded-xl border text-left transition-all ${form.serviceCategorySlug === cat.slug ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                {cat.slug.includes("solar") ? <Sun size={14} className="text-primary" /> : <Car size={14} className="text-primary" />}
                <span className="font-medium text-sm capitalize">{cat.name}</span>
              </div>
            </button>
          ))}
        </div>

        {needsVehicle && !hasVehicle && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-800">Add a vehicle first</p>
            <Link href="/customer/assets"><Button size="sm" variant="outline" className="gap-1 mt-2">Go to My Assets <ArrowRight size={12} /></Button></Link>
          </div>
        )}

        {needsSolar && !hasSolar && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-800">Add a solar site first</p>
            <Link href="/customer/assets"><Button size="sm" variant="outline" className="gap-1 mt-2">Go to My Assets <ArrowRight size={12} /></Button></Link>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {!isSolar && form.serviceCategorySlug && (
            <div>
              <Label>Select Service</Label>
              <Select value={form.serviceId} onValueChange={v => setForm(f => ({ ...f, serviceId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-service"><SelectValue placeholder="Choose a service..." /></SelectTrigger>
                <SelectContent>
                  {filteredServices.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} — from ₹{Number(s.basePrice).toLocaleString("en-IN")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsVehicle && hasVehicle && (
            <div>
              <Label>Vehicle</Label>
              <Select value={form.vehicleId} onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-vehicle"><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                <SelectContent>
                  {(vehicles ?? []).map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.make} {v.model} ({v.registrationNumber})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsSolar && hasSolar && (
            <div>
              <Label>Solar site</Label>
              <Select value={form.solarSiteId} onValueChange={v => setForm(f => ({ ...f, solarSiteId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-solar"><SelectValue placeholder="Select solar site..." /></SelectTrigger>
                <SelectContent>
                  {(solarSites ?? []).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.address} ({s.panelCount} panels)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selfBooking?.eligible && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
              <p className="font-medium text-green-800">Package visit available</p>
              <p className="text-muted-foreground">{selfBooking.remainingCredits} credits left · valid until {selfBooking.validUntil}</p>
            </div>
          )}

          {(serviceAddons ?? []).length > 0 && (
            <div>
              <Label>Add-ons (optional)</Label>
              <div className="mt-2 space-y-2">
                {(serviceAddons ?? []).map(addon => (
                  <label key={addon.id} className="flex items-center gap-2 text-sm border rounded-lg p-2 cursor-pointer">
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

          {estimatedPrice != null && (
            <div className="bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated price</span>
                <span className="font-semibold text-primary" data-testid="estimated-price">₹{estimatedPrice.toLocaleString("en-IN")}</span>
              </div>
              {pricingQuote && (pricingQuote as { vehicleCategory?: string }).vehicleCategory && (
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {(pricingQuote as { vehicleCategory?: string }).vehicleCategory} · {(pricingQuote as { seatCategory?: string }).seatCategory}
                </p>
              )}
              {selfBooking?.eligible && (
                <p className="text-xs text-green-700 mt-1">Service covered by your active package</p>
              )}
            </div>
          )}

          <LocationPicker
            value={bookingLocation}
            onChange={setBookingLocation}
            savedLocations={savedLocations}
            onSaveNew={(label, loc) => createSavedLoc.mutate({
              customerId: customerId!,
              label,
              address: loc.address,
              latitude: loc.latitude,
              longitude: loc.longitude,
              placeId: loc.placeId,
              isDefault: false,
            })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" min={today} value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="mt-1" data-testid="input-date" /></div>
            <div><Label>Time</Label><Input type="time" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))} className="mt-1" data-testid="input-time" /></div>
          </div>

          <div><Label>Notes (optional)</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." className="mt-1" data-testid="input-notes" /></div>

          <Button
            data-testid="btn-confirm-booking"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => {
              if (!bookingLocation) return;
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
            }}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold"
          >
            {createMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Booking...</> : "Confirm Booking"}
          </Button>
        </div>
      </div>
    </CustomerLayout>
  );
}
