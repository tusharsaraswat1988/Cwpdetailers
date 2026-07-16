import { useMemo } from "react";
import {
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
import { useSavedLocations } from "@/features/master-data/api";
import { useSelectedAddress } from "@/hooks/use-selected-address";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { PasswordSetupNudge } from "@/components/auth/PasswordSetupNudge";
import { usePendingFeedback } from "@/features/daily-cleaning/api";
import { buildHomeDashboard } from "@/lib/home-dashboard";
import type { RawSubscription } from "@/lib/customer-plans";
import { CurrentAddressBar } from "@/components/home/CurrentAddressBar";
import { OperationalHero } from "@/components/home/OperationalHero";
import { AdaptivePrimaryCta } from "@/components/home/AdaptivePrimaryCta";
import { CurrentPlanWidget } from "@/components/home/CurrentPlanWidget";
import { HomeBelowFold } from "@/components/home/HomeBelowFold";

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

export default function CustomerDashboard() {
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data: summary, isLoading: summaryLoading } = useGetCustomerSummary(customerId ?? 0, {
    query: {
      queryKey: getGetCustomerSummaryQueryKey(customerId ?? 0),
      enabled: customerId != null,
    },
  });

  const { data: subs, isLoading: subsLoading } = useListSubscriptions(
    { customerId: String(customerId ?? "") } as Parameters<typeof useListSubscriptions>[0],
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as Parameters<typeof getListSubscriptionsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );

  const { data: vehicles } = useListVehicles(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );

  const { data: solarSites } = useListSolarSites(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListSolarSitesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );

  const { data: savedLocations } = useSavedLocations(customerId ?? undefined);
  const { data: pendingFeedback } = usePendingFeedback();

  const vehicleRows = (vehicles ?? []) as VehicleRow[];
  const solarRows = (solarSites ?? []) as SolarRow[];

  const addressContext = useMemo(() => ({
    recentBookings: summary?.recentBookings,
    vehicles: vehicleRows,
    solarSites: solarRows,
    savedLocations,
  }), [summary?.recentBookings, vehicleRows, solarRows, savedLocations]);

  const { selected, selectLocation, savedLocations: saved } = useSelectedAddress(customerId, addressContext);

  const dashboard = useMemo(() => {
    if (customerId == null) return null;
    return buildHomeDashboard({
      recentBookings: summary?.recentBookings,
      pendingDues: summary?.pendingDues,
      subscriptions: (subs?.data ?? []) as RawSubscription[],
      hasPendingFeedback: (pendingFeedback?.length ?? 0) > 0,
      vehicles: vehicleRows,
      solarSites: solarRows,
      selectedAddress: selected,
    });
  }, [customerId, summary, subs, pendingFeedback, vehicleRows, solarRows, selected]);

  const loading = summaryLoading || subsLoading;

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <Skeleton className="h-48 w-full rounded-xl" />
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <NoCustomerProfileMessage />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="flex flex-col min-h-0">
        <section
          className="flex flex-col gap-2 shrink-0 overflow-hidden"
          style={{ maxHeight: ABOVE_FOLD_MAX }}
          data-testid="home-above-fold"
          aria-label="Today's service overview"
        >
          {loading || !dashboard ? (
            <>
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-[4.5rem] rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-[4.5rem] rounded-xl" />
            </>
          ) : (
            <>
              <CurrentAddressBar
                address={dashboard.currentAddress}
                selected={selected}
                savedLocations={saved}
                onSelectAddress={selectLocation}
              />
              <OperationalHero hero={dashboard.hero} />
              <AdaptivePrimaryCta cta={dashboard.cta} />
              <CurrentPlanWidget plan={dashboard.primaryPlan} />
            </>
          )}
        </section>

        <div className="mt-4 border-t border-border pt-3 shrink-0">
          <PasswordSetupNudge />
          {dashboard && <HomeBelowFold actionQueue={dashboard.actionQueue} />}
        </div>
      </div>
    </CustomerLayout>
  );
}
