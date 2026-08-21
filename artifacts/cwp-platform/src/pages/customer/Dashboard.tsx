import { useMemo } from "react";
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
import { useAccountScope } from "@/lib/account-scope";
import { useSavedLocations, useCreateSavedLocation, useUpdateSavedLocation, useDeleteSavedLocation, useSetDefaultSavedLocation } from "@/features/master-data/api";
import { useSelectedAddress } from "@/hooks/use-selected-address";
import { useCustomerLocationSources } from "@/hooks/use-customer-location-sources";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { PasswordSetupNudge } from "@/components/auth/PasswordSetupNudge";
import { usePendingFeedback } from "@/features/daily-cleaning/api";
import { buildHomeDashboard, pickPrimaryPlan } from "@/lib/home-dashboard";
import { activePlans, type RawSubscription } from "@/lib/customer-plans";
import { CurrentAddressBar } from "@/components/home/CurrentAddressBar";
import { OperationalHero } from "@/components/home/OperationalHero";
import { AdaptivePrimaryCta } from "@/components/home/AdaptivePrimaryCta";
import { CurrentPlanWidget } from "@/components/home/CurrentPlanWidget";
import { HomeBelowFold } from "@/components/home/HomeBelowFold";
import {
  CustomerPage,
  CustomerSkeleton,
  CustomerEmptyState,
} from "@/features/customer-ds";

/** Above-fold block max height — primary content fits one viewport without scroll. */
const ABOVE_FOLD_MAX = "calc(100dvh - var(--app-bar-height) - var(--bottom-nav-height) - 2rem)";

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
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

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

  const loading = summaryQuery.isLoading || subsQuery.isLoading || !addressSourcesReady || !initialized;

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <CustomerPage>
          <CustomerSkeleton className="h-48 w-full" />
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
      <CustomerPage className="space-y-0">
        <div className="flex flex-col min-h-0">
          <section
            className="flex flex-col gap-3 shrink-0 overflow-hidden"
            style={{ maxHeight: ABOVE_FOLD_MAX }}
            data-testid="home-above-fold"
            aria-label="Today's service overview"
          >
            {loading || !dashboard ? (
              <>
                <CustomerSkeleton className="h-14" />
                <CustomerSkeleton className="h-[5rem]" />
                <CustomerSkeleton className="h-12" />
                <CustomerSkeleton className="h-[5rem]" />
              </>
            ) : (
              <>
                <CurrentAddressBar
                  address={dashboard.currentAddress}
                  selected={selected}
                  savedLocations={savedQuery.data}
                  customerId={customerId}
                  onSelectAddress={selectLocation}
                  onSaveNew={data => createSavedLocation.mutateAsync(data)}
                  onUpdate={(id, data) => updateSavedLocation.mutateAsync({ id, ...data })}
                  onDelete={id => deleteSavedLocation.mutateAsync({ id, customerId })}
                  onSetDefault={id => setDefaultSavedLocation.mutateAsync({ id, customerId })}
                />
                <OperationalHero hero={dashboard.hero} />
                <AdaptivePrimaryCta cta={dashboard.cta} />
                <CurrentPlanWidget plan={dashboard.primaryPlan} />
              </>
            )}
          </section>

          <div className="mt-5 border-t border-border pt-4 shrink-0 space-y-3">
            <PasswordSetupNudge />
            {dashboard && <HomeBelowFold actionQueue={dashboard.actionQueue} />}
          </div>
        </div>
      </CustomerPage>
    </CustomerLayout>
  );
}
