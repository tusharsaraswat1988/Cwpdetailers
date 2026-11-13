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
import { PasswordSetupNudge } from "@/components/auth/PasswordSetupNudge";
import { usePendingFeedback } from "@/features/daily-cleaning/api";
import { buildHomeDashboard, pickPrimaryPlan } from "@/lib/home-dashboard";
import { activePlans, type RawSubscription } from "@/lib/customer-plans";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { useBranding } from "@/lib/branding";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";
import { guessCityFromAddress } from "@workspace/address-model";

import { ServiceAddressSelector } from "@/components/home/ServiceAddressSelector";
import { HomeGreeting } from "@/components/home/HomeGreeting";
import { MarketingHero } from "@/components/home/MarketingHero";
import { PromotionalOffersSection } from "@/components/home/PromotionalOffersSection";
import { LoyaltyRewardsCard } from "@/components/home/LoyaltyRewardsCard";
import { ServicesGrid } from "@/components/home/ServicesGrid";
import { CustomerReviewsSection } from "@/components/home/CustomerReviewsSection";
import { TodayServiceCard } from "@/components/home/TodayServiceCard";
import { UpcomingServicePreview } from "@/components/home/UpcomingServicePreview";

import {
  CustomerPage,
  CustomerSkeleton,
  CustomerEmptyState,
} from "@/features/customer-ds";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
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

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <CustomerPage>
          <CustomerSkeleton className="h-48 w-full rounded-2xl" />
        </CustomerPage>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
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
    <CustomerLayout>
      <CustomerPage className="space-y-6">
        {loading || !dashboard ? (
          <div className="space-y-6">
            {/* Address Selector Skeleton */}
            <CustomerSkeleton className="h-14 w-full rounded-2xl" />
            {/* Greeting Skeleton */}
            <div className="space-y-1.5 py-1">
              <CustomerSkeleton className="h-3.5 w-24 rounded-md" />
              <CustomerSkeleton className="h-7 w-44 rounded-md" />
            </div>
            {/* Cards 2-col Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
              <CustomerSkeleton className="h-52 w-full rounded-2xl" />
              <CustomerSkeleton className="h-52 w-full rounded-2xl" />
            </div>
            {/* Services 4-col Skeleton */}
            <div className="space-y-3">
              <CustomerSkeleton className="h-5 w-32 rounded-md" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <CustomerSkeleton className="h-40 rounded-2xl" />
                <CustomerSkeleton className="h-40 rounded-2xl" />
                <CustomerSkeleton className="h-40 rounded-2xl" />
                <CustomerSkeleton className="h-40 rounded-2xl" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Service Address Selector (immediately below Application Header, non-sticky, naturally scrolls) */}
            <ServiceAddressSelector
              selected={selected}
              address={dashboard.currentAddress}
              onClick={() => setAddressPickerOpen(true)}
            />

            {/* 2. Personalized Greeting */}
            <HomeGreeting customerName={customerQuery.data?.name} />

            {/* Outstanding Balance Banner if dues > 0 */}
            {pendingDues > 0 ? (
              <div
                className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 flex items-center justify-between gap-3 shadow-xs cursor-pointer hover:bg-amber-100/70 transition-colors"
                data-testid="home-dues-banner"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                      Payment Due
                    </p>
                    <p className="font-display font-bold text-base text-foreground">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold transition-colors shrink-0 shadow-xs cursor-pointer"
                  data-testid="pay-now-button"
                >
                  Pay Now <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <div
                className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                data-testid="home-all-clear-banner"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">
                      All Payments Clear
                    </p>
                    <p className="text-[11px] text-emerald-600">
                      No outstanding dues on your account
                    </p>
                  </div>
                </div>
                <Link
                  href={CUSTOMER_ROUTES.invoices}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline shrink-0"
                >
                  View Invoices
                </Link>
              </div>
            )}

            {/* Compact Active Membership Strip (Points to designated My Plans page) */}
            {dashboard.primaryPlan && (
              <div
                className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-100/90 text-xs text-foreground shadow-2xs"
                data-testid="home-membership-strip"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-2xs" />
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">
                      Active: {dashboard.primaryPlan.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {dashboard.primaryPlan.totalRemaining > 0
                        ? `${dashboard.primaryPlan.totalRemaining} visits remaining`
                        : "Managed doorstep care"}
                      {dashboard.primaryPlan.vehicleOrSite ? ` · ${dashboard.primaryPlan.vehicleOrSite}` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href={CUSTOMER_ROUTES.plans}
                  className="text-xs font-bold text-primary hover:underline shrink-0 flex items-center gap-1 pl-2"
                >
                  My Plans <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {/* Core Product Marketing Hero */}
            <MarketingHero cityName={currentCityName} />

            {/* Loyalty Rewards & Referral Strip */}
            <LoyaltyRewardsCard />

            {/* City/Branch-Specific Promotional Offers & Coupon Rewards */}
            <PromotionalOffersSection citySlug={currentCitySlug} cityName={currentCityName} />

            {/* Today's Service Card (Shown when service is active / scheduled today) */}
            {(dashboard.hero || dashboard.primaryPlan?.isDailyCleaning) && (
              <div data-testid="home-today-service">
                <TodayServiceCard
                  hero={dashboard.hero}
                  cta={dashboard.cta}
                  hasDailyCleaningPlan={Boolean(dashboard.primaryPlan?.isDailyCleaning)}
                />
              </div>
            )}

            {/* CWP Signature Services Showcase: Each card links to dedicated product detail page */}
            <ServicesGrid
              hasDailyCleaningPlan={Boolean(dashboard.primaryPlan?.isDailyCleaning)}
              citySlug={currentCitySlug}
              cityName={currentCityName}
            />

            {/* Customer Testimonials & Verified Reviews */}
            <CustomerReviewsSection />

            {/* Upcoming Bookings & Utility Reminders */}
            <div className="space-y-4 pt-1">
              {upcomingFutureBooking && (
                <UpcomingServicePreview booking={upcomingFutureBooking} />
              )}
              <PasswordSetupNudge />
            </div>
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
