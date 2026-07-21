import { useMemo } from "react";
import {
  useGetCustomerSummary,
  getGetCustomerSummaryQueryKey,
  useListSubscriptions,
  getListSubscriptionsQueryKey,
  useListVehicles,
  getListVehiclesQueryKey,
} from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import { activePlans, type RawSubscription } from "@/lib/customer-plans";
import { pickPrimaryPlan } from "@/lib/home-dashboard";

export type AccountSummaryMetrics = {
  activePlan: string;
  vehicleCount: number;
  nextWash: string;
  outstanding: string;
  outstandingAmount: number;
  loading: boolean;
};

function formatShortDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatOutstanding(totalDues?: string | null): { label: string; amount: number } {
  const amount = totalDues != null ? parseFloat(totalDues) : 0;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { label: "₹0", amount: 0 };
  }
  return {
    label: `₹${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`,
    amount,
  };
}

export function useAccountSummary(totalDues?: string | null): AccountSummaryMetrics {
  const { customerId } = useAccountScope();

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
        queryKey: getListSubscriptionsQueryKey({
          customerId: String(customerId ?? ""),
        } as Parameters<typeof getListSubscriptionsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );

  const { data: vehicles, isLoading: vehiclesLoading } = useListVehicles(
    { customerId: customerId ?? 0 },
    {
      query: {
        queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }),
        enabled: customerId != null,
      },
    },
  );

  return useMemo(() => {
    const plans = activePlans((subs?.data ?? []) as RawSubscription[]);
    const primary = pickPrimaryPlan(plans);

    const upcoming = (summary?.recentBookings ?? []).find(
      b =>
        b.status === "pending" ||
        b.status === "scheduled" ||
        b.status === "confirmed" ||
        b.status === "en_route" ||
        b.status === "in_progress" ||
        b.status === "rescheduled",
    );

    const nextWash =
      formatShortDate(upcoming?.scheduledDate) ??
      formatShortDate(primary?.nextVisitDate) ??
      "—";

    const { label: outstanding, amount: outstandingAmount } = formatOutstanding(totalDues);

    return {
      activePlan: primary?.name ?? "None",
      vehicleCount: (vehicles ?? []).length,
      nextWash,
      outstanding,
      outstandingAmount,
      loading: summaryLoading || subsLoading || vehiclesLoading,
    };
  }, [subs, summary, vehicles, totalDues, summaryLoading, subsLoading, vehiclesLoading]);
}
