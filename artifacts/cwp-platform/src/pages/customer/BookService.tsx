import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateBooking, getListBookingsQueryKey,
  useListVehicles, getListVehiclesQueryKey,
  useListSolarSites, getListSolarSitesQueryKey,
  useListSubscriptions, getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import { computeSolarCleaningPrice } from "@/lib/solar-pricing";
import {
  useCatalogServices, useSavedLocations, useCreateSavedLocation,
  usePricingQuote, type LocationValue, type CatalogService,
} from "@/features/master-data/api";
import {
  useCatalogPricingQuote, useSelfBookingCheck,
} from "@/features/service-catalog/api";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";
import { QuickAddAssetSheet } from "@/components/shared/QuickAddAssetSheet";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { moduleError } from "@/lib/moduleErrors";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { cn } from "@/lib/utils";
import {
  type CustomerPlan, type RawSubscription,
} from "@/lib/customer-plans";
import { checkCoverage } from "@/lib/coverage-client";
import { buildAvailableDates, firstAvailableDate, slotsForDate } from "@/lib/schedule-slots";
import {
  parseScheduleEntryParams,
  resolveBookingAddressForEntry,
  resolveScheduleEntryContext,
} from "@/lib/schedule-entry";
import {
  type ScheduleAsset, type ScheduleStep, type PlanMode,
  plansForAsset, countAssets, resolveActiveStep, nextStep, prevStep,
  filterServicesForCoverage, stepTitle, inferPlanMode, shouldSkipStep,
} from "@/lib/schedule-journey";
import { ScheduleStepProgress } from "@/components/schedule/ScheduleStepProgress";
import { ScheduleAssetStep } from "@/components/schedule/ScheduleAssetStep";
import { SchedulePlanStep } from "@/components/schedule/SchedulePlanStep";
import { ScheduleServiceStep } from "@/components/schedule/ScheduleServiceStep";
import { ScheduleDateStep } from "@/components/schedule/ScheduleDateStep";
import { ScheduleTimeStep } from "@/components/schedule/ScheduleTimeStep";
import { ScheduleReviewStep } from "@/components/schedule/ScheduleReviewStep";
import { ScheduleSuccessScreen } from "@/components/schedule/ScheduleSuccessScreen";
import { loadSelectedAddress, saveSelectedAddress } from "@/lib/selected-address";

type VehicleRow = {
  id: number;
  make?: string;
  model?: string;
  registrationNumber?: string;
  serviceAddress?: string | null;
  address?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
  locationComplete?: boolean;
  vehicleModelId?: number;
};

type SolarRow = {
  id: number;
  address?: string;
  panelCount?: number;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

function locationFromRecord(row: VehicleRow | SolarRow, kind: "vehicle" | "solar"): LocationValue | null {
  const address = kind === "vehicle"
    ? ((row as VehicleRow).serviceAddress ?? (row as VehicleRow).address ?? "").trim()
    : ((row as SolarRow).address ?? "").trim();
  const lat = row.serviceLat;
  const lng = row.serviceLng;
  if (!address || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { address, latitude: lat, longitude: lng, placeId: row.placeId ?? undefined };
}

function enrichAsset(
  asset: ScheduleAsset,
  vehicles: VehicleRow[],
  solarSites: SolarRow[],
): ScheduleAsset {
  const row = asset.kind === "vehicle"
    ? vehicles.find(v => v.id === asset.id)
    : solarSites.find(s => s.id === asset.id);
  if (!row) return asset;
  return { ...asset, location: locationFromRecord(row, asset.kind) };
}

export default function BookService() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const [step, setStep] = useState<ScheduleStep>("asset");
  const [asset, setAsset] = useState<ScheduleAsset | null>(null);
  const [planMode, setPlanMode] = useState<PlanMode | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CustomerPlan | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingLocation, setBookingLocation] = useState<LocationValue | null>(null);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [successId, setSuccessId] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: catalogServices, isLoading: servicesLoading, isError: servicesError, refetch: refetchServices } = useCatalogServices();
  const { data: vehicles } = useListVehicles({ customerId: customerId ?? 0 }, {
    query: { queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null },
  });
  const { data: solarSites } = useListSolarSites({ customerId: customerId ?? 0 }, {
    query: { queryKey: getListSolarSitesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null },
  });
  const { data: savedLocations } = useSavedLocations(customerId ?? undefined);
  const createSavedLoc = useCreateSavedLocation();

  const { data: subsData } = useListSubscriptions(
    { customerId: String(customerId ?? "") } as Parameters<typeof useListSubscriptions>[0],
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as Parameters<typeof getListSubscriptionsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );

  const vehicleRows = (vehicles ?? []) as VehicleRow[];
  const solarRows = (solarSites ?? []) as SolarRow[];
  const rawSubs = (subsData?.data ?? []) as RawSubscription[];
  const assetPlans = useMemo(() => plansForAsset(rawSubs, asset), [rawSubs, asset]);
  const assetCount = countAssets(vehicleRows, solarRows);

  const selectedVehicle = asset?.kind === "vehicle" ? vehicleRows.find(v => v.id === asset.id) : undefined;
  const selectedSolar = asset?.kind === "solar" ? solarRows.find(s => s.id === asset.id) : undefined;

  const { data: coverage, isLoading: coverageLoading, refetch: refetchCoverage } = useQuery({
    queryKey: ["schedule", "coverage", customerId, bookingLocation?.address, bookingLocation?.latitude],
    queryFn: () => checkCoverage({
      customerId: customerId ?? undefined,
      address: bookingLocation!.address,
      locationLat: bookingLocation!.latitude,
      locationLng: bookingLocation!.longitude,
      placeId: bookingLocation!.placeId,
      serviceId: serviceId ? parseInt(serviceId) : undefined,
    }),
    enabled: customerId != null && bookingLocation != null && step !== "asset" && step !== "plan",
    staleTime: 30_000,
  });

  const availableServices = useMemo(() => {
    if (!catalogServices || !asset) return [];
    return filterServicesForCoverage(
      catalogServices as CatalogService[],
      coverage?.availableServices,
      asset.kind,
    );
  }, [catalogServices, coverage, asset]);

  const selectedService = availableServices.find(s => String(s.id) === serviceId)
    ?? (catalogServices as CatalogService[] | undefined)?.find(s => String(s.id) === serviceId);

  const { data: selfBooking } = useSelfBookingCheck(
    customerId ?? undefined,
    serviceId ? parseInt(serviceId) : undefined,
  );

  const { data: pricingQuoteLegacy } = usePricingQuote(
    serviceId ? parseInt(serviceId) : undefined,
    selectedVehicle?.vehicleModelId,
  );
  const { data: catalogQuote } = useCatalogPricingQuote({
    serviceId: serviceId ? parseInt(serviceId) : undefined,
    vehicleModelId: selectedVehicle?.vehicleModelId,
    panelCount: selectedSolar?.panelCount,
    citySlug: "varanasi",
  });
  const pricingQuote = catalogQuote ?? pricingQuoteLegacy;

  const coveredByPlan = Boolean(planMode === "plan" && selfBooking?.eligible);
  const estimatedPrice = useMemo(() => {
    if (coveredByPlan) return 0;
    if (asset?.kind === "solar" && selectedSolar?.panelCount != null) {
      return computeSolarCleaningPrice(selectedSolar.panelCount);
    }
    if (pricingQuote) return Number((pricingQuote as { amount?: number }).amount ?? 0);
    if (selectedService) return Number(selectedService.basePrice);
    return null;
  }, [coveredByPlan, asset, selectedSolar, pricingQuote, selectedService]);

  const dateOptions = useMemo(() => buildAvailableDates(14), []);
  const timeSlots = useMemo(
    () => (scheduledDate ? slotsForDate(scheduledDate) : []),
    [scheduledDate],
  );

  const createMutation = useCreateBooking({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        setSuccessId(data.id);
        toast({ title: "Request received" });
      },
      onError: (err: { response?: { data?: { error?: string; message?: string } } }) =>
        toast({
          title: err?.response?.data?.message ?? err?.response?.data?.error ?? moduleError("bookings", "save"),
          variant: "destructive",
        }),
    },
  });

  const applyAutoSkips = useCallback(() => {
    const ctx = {
      assetCount,
      asset,
      eligiblePlanCount: assetPlans.length,
      planMode,
      selectedPlan,
      serviceCount: availableServices.length,
      serviceSelected: Boolean(serviceId),
      dateSelected: Boolean(scheduledDate),
      timeSelected: Boolean(scheduledTime),
    };
    return resolveActiveStep(ctx);
  }, [assetCount, asset, assetPlans.length, planMode, selectedPlan, availableServices.length, serviceId, scheduledDate, scheduledTime]);

  // Initialize from URL / hints / single asset (unified entry context)
  useEffect(() => {
    if (initialized || customerId == null) return;

    const entry = resolveScheduleEntryContext({
      params: parseScheduleEntryParams(window.location.search),
      customerId,
      vehicles: vehicleRows,
      solarSites: solarRows,
      subscriptions: rawSubs,
    });

    if (entry.redirectDailyCleaning) {
      navigate("/customer/daily-cleaning");
      return;
    }

    if (entry.asset) setAsset(entry.asset);
    if (entry.planMode) setPlanMode(entry.planMode);
    if (entry.selectedPlan) setSelectedPlan(entry.selectedPlan);
    if (entry.address) setBookingLocation(entry.address);
    setInitialized(true);
  }, [initialized, customerId, vehicleRows, solarRows, rawSubs, navigate]);

  // Resolve address when asset selected
  useEffect(() => {
    if (!asset || !customerId) return;
    const enriched = enrichAsset(asset, vehicleRows, solarRows);
    if (enriched.location !== asset.location) {
      setAsset(enriched);
    }
    const resolved = resolveBookingAddressForEntry({
      asset: enriched,
      selectedAddress: loadSelectedAddress(customerId),
    });
    if (resolved) setBookingLocation(resolved);
  }, [asset?.id, asset?.kind, vehicleRows, solarRows, customerId]);

  // Auto plan mode when asset known
  useEffect(() => {
    if (!asset || planMode != null) return;
    if (assetPlans.length === 1) {
      const plan = assetPlans[0];
      if (plan.isDailyCleaning) {
        navigate("/customer/daily-cleaning");
        return;
      }
      setSelectedPlan(plan);
      setPlanMode("plan");
    } else if (assetPlans.length === 0) {
      setPlanMode("one_time");
    }
  }, [asset, assetPlans, planMode, navigate]);

  // Auto-select single service
  useEffect(() => {
    if (step !== "service" || serviceId) return;
    if (availableServices.length === 1) {
      setServiceId(String(availableServices[0].id));
    } else if (asset?.kind === "solar" && availableServices.length > 0 && !serviceId) {
      const solarSvc = availableServices.find(s => s.category === "solar_cleaning") ?? availableServices[0];
      setServiceId(String(solarSvc.id));
    }
  }, [step, availableServices, serviceId, asset]);

  // Auto date/time
  useEffect(() => {
    if (!scheduledDate) {
      const first = firstAvailableDate(dateOptions);
      if (first && step !== "asset" && step !== "plan" && asset && serviceId) setScheduledDate(first);
    }
  }, [scheduledDate, dateOptions, step, asset, serviceId]);

  useEffect(() => {
    if (scheduledDate && !scheduledTime) {
      const slots = slotsForDate(scheduledDate);
      if (slots.length === 1) setScheduledTime(slots[0]);
      else if (slots.length > 0 && !slots.includes(scheduledTime)) setScheduledTime(slots[0]);
    }
  }, [scheduledDate, scheduledTime]);

  // Auto-advance past skippable steps after initialization
  useEffect(() => {
    if (!initialized) return;
    const target = applyAutoSkips();
    setStep(prev => {
      const order: ScheduleStep[] = ["asset", "plan", "service", "date", "time", "review"];
      return order.indexOf(target) > order.indexOf(prev) ? target : prev;
    });
  }, [initialized, asset?.id, planMode, selectedPlan?.id, serviceId, scheduledDate, scheduledTime, applyAutoSkips]);

  const goNext = () => {
    const n = nextStep(step);
    if (n) setStep(n);
  };

  const goBack = () => {
    const p = prevStep(step);
    if (p) setStep(p);
  };

  const canContinue = useMemo(() => {
    switch (step) {
      case "asset": return asset != null;
      case "plan": return planMode != null && (planMode === "one_time" || selectedPlan != null);
      case "service": return Boolean(serviceId) && (coverage?.success !== false);
      case "date": return Boolean(scheduledDate);
      case "time": return Boolean(scheduledTime);
      case "review": return Boolean(bookingLocation && asset && serviceId && scheduledDate && scheduledTime);
      default: return false;
    }
  }, [step, asset, planMode, selectedPlan, serviceId, coverage, scheduledDate, scheduledTime, bookingLocation]);

  const handleAssetSelect = (next: ScheduleAsset) => {
    setAsset(enrichAsset(next, vehicleRows, solarRows));
    setPlanMode(null);
    setSelectedPlan(null);
    setServiceId("");
  };

  const handleSelectPlan = (plan: CustomerPlan) => {
    if (plan.isDailyCleaning) {
      navigate("/customer/daily-cleaning");
      return;
    }
    setSelectedPlan(plan);
    setPlanMode("plan");
    setServiceId("");
  };

  const submitRequest = () => {
    if (!bookingLocation || !customerId || !asset || !scheduledDate) return;
    const serviceType = asset.kind === "solar"
      ? "solar_cleaning"
      : (selectedService?.category ?? "car_wash");
    createMutation.mutate({
      data: {
        customerId,
        serviceId: serviceId ? parseInt(serviceId) : undefined,
        vehicleId: asset.kind === "vehicle" ? asset.id : undefined,
        solarSiteId: asset.kind === "solar" ? asset.id : undefined,
        serviceType: serviceType as "car_wash" | "detailing" | "solar_cleaning" | "pickup_drop",
        scheduledDate,
        scheduledTime,
        notes: notes || undefined,
        address: bookingLocation.address,
        locationLat: bookingLocation.latitude,
        locationLng: bookingLocation.longitude,
        placeId: bookingLocation.placeId,
        citySlug: "varanasi",
        entitlementId: selfBooking?.eligible ? selfBooking.entitlementId : undefined,
      } as Parameters<typeof createMutation.mutate>[0]["data"],
    });
    saveSelectedAddress(customerId, {
      ...bookingLocation,
      assetId: asset.id,
      assetType: asset.kind,
      assetLabel: asset.subtitle || asset.name,
    });
  };

  const resetFlow = () => {
    setSuccessId(null);
    setStep("asset");
    setAsset(null);
    setPlanMode(null);
    setSelectedPlan(null);
    setServiceId("");
    setScheduledDate("");
    setScheduledTime("");
    setNotes("");
    setBookingLocation(null);
    setInitialized(false);
  };

  const skipCtx = useMemo(() => ({
    assetCount,
    asset,
    eligiblePlanCount: assetPlans.length,
    planMode,
    selectedPlan,
    serviceCount: availableServices.length,
    serviceSelected: Boolean(serviceId),
    dateSelected: Boolean(scheduledDate),
    timeSelected: Boolean(scheduledTime),
  }), [assetCount, asset, assetPlans.length, planMode, selectedPlan, availableServices.length, serviceId, scheduledDate, scheduledTime]);

  const hiddenSteps: ScheduleStep[] = useMemo(() => {
    const hidden: ScheduleStep[] = [];
    if (shouldSkipStep("asset", skipCtx)) hidden.push("asset");
    if (shouldSkipStep("plan", skipCtx)) hidden.push("plan");
    return hidden;
  }, [skipCtx]);

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

  if (successId != null) {
    return (
      <CustomerLayout>
        <ScheduleSuccessScreen requestId={successId} onScheduleAnother={resetFlow} />
      </CustomerLayout>
    );
  }

  const coverageError = coverage && !coverage.success && step === "service"
    ? coverage.message
    : servicesError
      ? "Could not load services. Check your connection."
      : null;

  return (
    <CustomerLayout>
      <div
        className={cn(
          "max-w-lg mx-auto space-y-5",
          step === "review" && "pb-[calc(var(--bottom-nav-height)+5.5rem)]",
        )}
        data-testid="schedule-page"
      >
        <header className="space-y-3">
          <div>
            <h1 className="font-display font-bold text-2xl">Schedule</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{stepTitle(step, asset?.kind)}</p>
          </div>
          <ScheduleStepProgress step={step} hiddenSteps={hiddenSteps} />
        </header>

        {step === "asset" && (
          <ScheduleAssetStep
            vehicles={vehicleRows}
            solarSites={solarRows}
            selected={asset}
            onSelect={handleAssetSelect}
          />
        )}

        {step === "plan" && asset && (
          <SchedulePlanStep
            eligiblePlans={assetPlans}
            selectedPlan={selectedPlan}
            planMode={planMode}
            onSelectPlan={handleSelectPlan}
            onSelectOneTime={() => { setPlanMode("one_time"); setSelectedPlan(null); setServiceId(""); }}
          />
        )}

        {step === "service" && asset && (
          <ScheduleServiceStep
            services={availableServices}
            selectedId={serviceId}
            onSelect={setServiceId}
            loading={servicesLoading || coverageLoading}
            error={coverageError}
            onRetry={() => { void refetchServices(); void refetchCoverage(); }}
            coveredByPlan={coveredByPlan}
          />
        )}

        {step === "date" && (
          <ScheduleDateStep
            dates={dateOptions}
            selected={scheduledDate}
            onSelect={d => { setScheduledDate(d); setScheduledTime(""); }}
          />
        )}

        {step === "time" && (
          <ScheduleTimeStep
            slots={timeSlots}
            selected={scheduledTime}
            onSelect={setScheduledTime}
          />
        )}

        {step === "review" && asset && bookingLocation && selectedService && (
          <ScheduleReviewStep
            asset={asset}
            address={bookingLocation}
            planMode={planMode ?? inferPlanMode(assetPlans.length)}
            plan={selectedPlan}
            serviceName={selectedService.name}
            date={scheduledDate}
            time={scheduledTime}
            notes={notes}
            onNotesChange={setNotes}
            onChangeAddress={() => setAddressSheetOpen(true)}
            estimatedPrice={estimatedPrice}
            coveredByPlan={coveredByPlan}
          />
        )}

        <div className="flex gap-2 pt-1">
          {step !== "asset" && (
            <Button type="button" variant="outline" className="h-11" onClick={goBack} data-testid="schedule-back">
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
          )}
          {step !== "review" ? (
            <Button
              className="flex-1 h-11"
              disabled={!canContinue}
              onClick={goNext}
              data-testid="schedule-continue"
            >
              Continue <ArrowRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button
              className="flex-1 h-11 font-semibold"
              disabled={!canContinue || createMutation.isPending}
              onClick={submitRequest}
              data-testid="schedule-request"
            >
              {createMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-2" />Submitting…</>
              ) : (
                "Request Service"
              )}
            </Button>
          )}
        </div>
      </div>

      {step === "review" && (
        <div className="fixed inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur bottom-[var(--bottom-nav-height)] md:hidden">
          <div className="max-w-lg mx-auto px-4 py-3">
            <Button
              className="w-full h-12 font-semibold"
              disabled={!canContinue || createMutation.isPending}
              onClick={submitRequest}
            >
              Request Service
            </Button>
          </div>
        </div>
      )}

      <QuickAddAssetSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        customerId={customerId}
        kind={asset?.kind === "solar" ? "solar" : "vehicle"}
        onCreated={(id) => {
          if (asset?.kind === "solar") {
            setAsset(a => a ? { ...a, id } : a);
          } else {
            setAsset(a => a ? { ...a, id, kind: "vehicle" } : a);
          }
        }}
      />

      <AddressPickerSheet
        open={addressSheetOpen}
        onOpenChange={setAddressSheetOpen}
        value={bookingLocation}
        savedLocations={savedLocations}
        onSelect={loc => {
          setBookingLocation(loc);
          if (customerId) saveSelectedAddress(customerId, loc);
          void refetchCoverage();
        }}
        onSaveNew={(label, loc) => createSavedLoc.mutate({
          customerId,
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
