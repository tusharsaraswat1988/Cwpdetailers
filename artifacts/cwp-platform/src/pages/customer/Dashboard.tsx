import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useGetCustomer,
  getGetCustomerQueryKey,
  useGetCustomerSummary,
  getGetCustomerSummaryQueryKey,
  useListSubscriptions,
  getListSubscriptionsQueryKey,
  useListVehicles,
  getListVehiclesQueryKey,
  useListSolarSites,
  getListSolarSitesQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import {
  useSavedLocations,
  useCreateSavedLocation,
  useUpdateSavedLocation,
  useDeleteSavedLocation,
  useSetDefaultSavedLocation,
} from "@/features/master-data/api";
import { useSelectedAddress } from "@/hooks/use-selected-address";
import { useCustomerLocationSources } from "@/hooks/use-customer-location-sources";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { usePendingFeedback } from "@/features/daily-cleaning/api";
import { buildHomeDashboard, pickPrimaryPlan } from "@/lib/home-dashboard";
import { activePlans, type RawSubscription } from "@/lib/customer-plans";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { useBranding } from "@/lib/branding";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";
import { guessCityFromAddress } from "@workspace/address-model";

import { HomeGreeting } from "@/components/home/HomeGreeting";
import { MarketingHero } from "@/components/home/MarketingHero";
import { ServicesGrid } from "@/components/home/ServicesGrid";

import {
  CustomerPage,
  CustomerSkeleton,
  CustomerEmptyState,
} from "@/features/customer-ds";
import { AlertCircle, ArrowRight, ChevronDown, MapPin } from "lucide-react";
import { CustomerPaymentReviewDialog } from "@/components/payment/CustomerPaymentReviewDialog";

type VehicleRow = {
  id: number;
  registrationNumber?: string;
  make?: string;
  model?: string;
  serviceAddress?: string | null;
  address?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

type SolarRow = {
  id: number;
  address?: string;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

function querySettled(q: { isFetched: boolean; isError: boolean }): boolean {
  return q.isFetched || q.isError;
}

export default function CustomerDashboard() {
  const branding = useBranding();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);

  const summaryQuery = useGetCustomerSummary(customerId ?? 0, {
    query: {
      queryKey: getGetCustomerSummaryQueryKey(customerId ?? 0),
      enabled: customerId != null,
    },
  });

  const subsQuery = useListSubscriptions(
    { customerId: String(customerId ?? "") } as Parameters<typeof useListSubscriptions>[0],
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as Parameters<typeof getListSubscriptionsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );

  const vehiclesQuery = useListVehicles(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );

  const solarQuery = useListSolarSites(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListSolarSitesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );

  const customerQuery = useGetCustomer(customerId ?? 0, {
    query: {
      queryKey: getGetCustomerQueryKey(customerId ?? 0),
      enabled: customerId != null,
    },
  });

  const savedQuery = useSavedLocations(customerId ?? undefined);
  const { serviceLocations, structuredAddresses, ready: locationCatalogReady } = useCustomerLocationSources(customerId);
  const { data: pendingFeedback } = usePendingFeedback();
  const createSavedLocation = useCreateSavedLocation();
  const updateSavedLocation = useUpdateSavedLocation();
  const deleteSavedLocation = useDeleteSavedLocation();
  const setDefaultSavedLocation = useSetDefaultSavedLocation();

  const vehicleRows = useMemo(
    () => (vehiclesQuery.data ?? []) as VehicleRow[],
    [vehiclesQuery.data],
  );
  const solarRows = useMemo(
    () => (solarQuery.data ?? []) as SolarRow[],
    [solarQuery.data],
  );
  const subscriptions = useMemo(
    () => (subsQuery.data?.data ?? []) as RawSubscription[],
    [subsQuery.data],
  );
  const primaryPlan = useMemo(
    () => pickPrimaryPlan(activePlans(subscriptions)),
    [subscriptions],
  );
  const planVehicleId = primaryPlan?.vehicleId ?? subscriptions.find(s => s.vehicleId != null)?.vehicleId ?? null;
  const planSolarSiteId = primaryPlan?.solarSiteId ?? subscriptions.find(s => s.solarSiteId != null)?.solarSiteId ?? null;

  const addressSourcesReady = customerId == null || (
    locationCatalogReady
    && querySettled(vehiclesQuery)
    && querySettled(solarQuery)
    && querySettled(savedQuery)
    && querySettled(customerQuery)
  );

  const addressContext = useMemo(() => ({
    ready: addressSourcesReady,
    recentBookings: summaryQuery.data?.recentBookings,
    vehicles: vehicleRows,
    solarSites: solarRows,
    savedLocations: savedQuery.data,
    serviceLocations,
    structuredAddresses,
    profileAddress: customerQuery.data?.address ?? null,
    planVehicleId,
    planSolarSiteId,
  }), [
    addressSourcesReady,
    summaryQuery.data?.recentBookings,
    vehicleRows,
    solarRows,
    savedQuery.data,
    serviceLocations,
    structuredAddresses,
    customerQuery.data?.address,
    planVehicleId,
    planSolarSiteId,
  ]);

  const { selected, initialized, selectLocation } = useSelectedAddress(customerId, addressContext);

  const dashboard = useMemo(() => {
    if (customerId == null) return null;
    return buildHomeDashboard({
      recentBookings: summaryQuery.data?.recentBookings,
      pendingDues: summaryQuery.data?.pendingDues,
      subscriptions,
      hasPendingFeedback: (pendingFeedback?.length ?? 0) > 0,
      vehicles: vehicleRows,
      solarSites: solarRows,
      selectedAddress: selected,
    });
  }, [customerId, summaryQuery.data, subscriptions, pendingFeedback, vehicleRows, solarRows, selected]);

  // Find upcoming future booking (excluding today's hero booking)
  const upcomingFutureBooking = useMemo(() => {
    const bookings = summaryQuery.data?.recentBookings ?? [];
    return bookings.find(b => {
      if (b.status === "cancelled" || b.status === "completed") return false;
      const d = new Date(b.scheduledDate.includes("T") ? b.scheduledDate : `${b.scheduledDate}T00:00:00`);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return d > today;
    });
  }, [summaryQuery.data?.recentBookings]);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const pendingDues = useMemo(() => {
    const summaryVal = summaryQuery.data?.pendingDues;
    if (summaryVal !== undefined && summaryVal !== null) {
      const num = Number(summaryVal);
      if (num > 0) return num;
    }
    const profileVal = customerQuery.data?.totalDues;
    if (profileVal !== undefined && profileVal !== null) {
      const num = Number(profileVal);
      if (num > 0) return num;
    }
    return Number(summaryVal ?? profileVal ?? 0);
  }, [summaryQuery.data?.pendingDues, customerQuery.data?.totalDues]);
  const loading = (summaryQuery.isLoading && customerQuery.isLoading) || !addressSourcesReady || !initialized;

  const currentCityName = useMemo(() => {
    return selected?.cityName || (selected?.address ? guessCityFromAddress(selected.address) : null) || "Varanasi";
  }, [selected?.cityName, selected?.address]);

  const currentCitySlug = useMemo(() => {
    return currentCityName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  }, [currentCityName]);

  const shortAddressLabel = useMemo(() => {
    if (selected?.assetLabel) return selected.assetLabel;
    if (selected?.address) {
      const parts = selected.address.split(",");
      return parts[0].trim() || currentCityName;
    }
    return currentCityName || "Select Location";
  }, [selected?.assetLabel, selected?.address, currentCityName]);

  const headerAddressPill = (
    <button
      type="button"
      onClick={() => setAddressPickerOpen(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-foreground text-xs font-semibold max-w-[210px] sm:max-w-xs transition-colors cursor-pointer border border-slate-200/80 truncate shadow-2xs"
      aria-label={`Current service location: ${shortAddressLabel}. Tap to change`}
      data-testid="home-header-address-pill"
    >
      <MapPin size={13} className="text-primary shrink-0" />
      <span className="truncate">{shortAddressLabel}</span>
      <ChevronDown size={13} className="text-muted-foreground shrink-0" />
    </button>
  );

  if (scopeLoading) {
    return (
      <CustomerLayout headerCenter={headerAddressPill}>
        <CustomerPage>
          <CustomerSkeleton className="h-48 w-full rounded-2xl" />
        </CustomerPage>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout headerCenter={headerAddressPill}>
        <CustomerPage>
          <CustomerEmptyState
            title="Account not linked"
            description="Your login is not linked to a customer profile yet."
            action={<NoCustomerProfileMessage />}
            hint=""
          />
        </CustomerPage>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout headerCenter={headerAddressPill}>
      <CustomerPage className="space-y-4">
        {loading || !dashboard ? (
          <div className="space-y-4">
            {/* Greeting Skeleton */}
            <div className="space-y-1 py-1">
              <CustomerSkeleton className="h-3.5 w-24 rounded-md" />
              <CustomerSkeleton className="h-7 w-40 rounded-md" />
            </div>
            {/* Hero Skeleton */}
            <CustomerSkeleton className="h-36 w-full rounded-2xl" />
            {/* Services Skeleton */}
            <div className="space-y-3 pt-2">
              <CustomerSkeleton className="h-5 w-32 rounded-md" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                <CustomerSkeleton className="h-40 rounded-2xl" />
                <CustomerSkeleton className="h-40 rounded-2xl" />
                <CustomerSkeleton className="h-40 rounded-2xl" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Personalized Greeting */}
            <HomeGreeting customerName={customerQuery.data?.name} />

            {/* 2. Outstanding Balance Reminder — Only displayed when dues > 0; suppressed when all clear */}
            {pendingDues > 0 && (
              <div
                className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:bg-amber-100/70 transition-colors"
                data-testid="home-dues-banner"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertCircle size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                      Payment Due
                    </p>
                    <p className="font-display font-semibold text-sm sm:text-base text-foreground truncate">
                      ₹{pendingDues.toLocaleString("en-IN")} Outstanding
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPaymentDialogOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold shrink-0 cursor-pointer shadow-2xs"
                  data-testid="pay-now-button"
                >
                  Pay Now <ArrowRight size={13} />
                </button>
              </div>
            )}

            {/* 3. Compact Active Membership Strip — Only displayed if an active plan exists */}
            {dashboard.primaryPlan && (
              <div
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200/90 text-xs text-foreground shadow-2xs"
                data-testid="home-membership-strip"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate text-sm">
                      Active: {dashboard.primaryPlan.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {dashboard.primaryPlan.totalRemaining > 0
                        ? `${dashboard.primaryPlan.totalRemaining} visits remaining`
                        : "Managed doorstep care"}
                      {dashboard.primaryPlan.vehicleOrSite ? ` · ${dashboard.primaryPlan.vehicleOrSite}` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href={CUSTOMER_ROUTES.plans}
                  className="text-xs font-semibold text-primary hover:underline shrink-0 flex items-center gap-1 pl-2"
                >
                  View My Plan <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {/* 4. Compact 18% Height Marketing Banner */}
            <MarketingHero cityName={currentCityName} />

            {/* 5. CWP Signature Services Showcase — Available immediately without scrolling past unrelated blocks */}
            <ServicesGrid
              hasDailyCleaningPlan={Boolean(dashboard.primaryPlan?.isDailyCleaning)}
              citySlug={currentCitySlug}
              cityName={currentCityName}
            />
          </div>
        )}
      </CustomerPage>

      {/* Global Address Picker Sheet for Quick Action */}
      <AddressPickerSheet
        open={addressPickerOpen}
        onOpenChange={setAddressPickerOpen}
        value={selected}
        savedLocations={savedQuery.data}
        customerId={customerId}
        onSelect={(loc, meta) => {
          selectLocation(loc, meta ? { assetLabel: meta.assetLabel } : undefined);
          setAddressPickerOpen(false);
        }}
        onSaveNew={data => createSavedLocation.mutateAsync(data)}
        onUpdate={(id, data) => updateSavedLocation.mutateAsync({ id, ...data })}
        onDelete={id => deleteSavedLocation.mutateAsync({ id, customerId })}
        onSetDefault={id => setDefaultSavedLocation.mutateAsync({ id, customerId })}
      />

      {/* Cashfree Payment Review Dialog */}
      <CustomerPaymentReviewDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        customerId={customerId ?? undefined}
        customerName={customerQuery.data?.name}
        outstandingAmount={pendingDues}
        payableAmount={pendingDues}
        onPaymentSuccess={() => {
          summaryQuery.refetch();
          customerQuery.refetch();
        }}
      />
    </CustomerLayout>
  );
}
