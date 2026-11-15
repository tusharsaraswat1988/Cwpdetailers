/**
 * Central Branch Scope Bridge & Universal Data Refresh Orchestrator
 * (ADMIN-020: Admin Branch Scope Hardening & Universal Data Refresh Repair)
 *
 * Ensures that when an admin selects an authorized branch:
 * 1. Zustand activeBranchId & activeCityId are updated synchronously.
 * 2. All branch-dependent query keys are invalidated and refetched.
 * 3. Scope transition events are dispatched to clear branch-dependent local component states.
 * 4. User-visible feedback (toast and scope transition indicator) is triggered.
 */

import type { QueryClient } from "@tanstack/react-query";
import { useAppStore } from "./store";
import { toast } from "@/hooks/use-toast";

export const BRANCH_DEPENDENT_QUERY_KEYS = [
  ["bookings"],
  ["/api/bookings"],
  ["customers"],
  ["/api/customers"],
  ["staff"],
  ["staff-ecosystem"],
  ["/api/staff"],
  ["subscriptions"],
  ["/api/subscriptions"],
  ["commercial-billing"],
  ["/api/billing"],
  ["admin", "ledger"],
  ["/api/invoices"],
  ["/api/payments"],
  ["/api/expenses"],
  ["/api/quotations"],
  ["dcms"],
  ["daily-cleaning"],
  ["/api/daily-cleaning"],
  ["operations-command-center"],
  ["assignments"],
  ["/api/assignments"],
  ["jobs"],
  ["/api/jobs"],
  ["leadStats"],
  ["leads"],
  ["/api/leads"],
  ["analytics"],
  ["/api/analytics"],
  ["makeup-approvals"],
  ["/api/admin/makeup-approvals"],
  ["churned"],
  ["/api/churned"],
  ["calendar-hours"],
  ["calendar-closures"],
  ["/api/admin/dashboard"],
  ["admin-dashboard"],
  ["admin-support-tickets"],
  ["service-exceptions-list"],
  ["service-quality-analytics"],
  ["supervisor-quality-hub"],
  ["operational-zones"],
  ["operational-zones-simple"],
  ["location-pricing-rules"],
  ["admin", "payments"],
  ["marketing-campaigns"],
  ["marketing-analytics"],
  ["marketing-media"],
  ["marketing-sections"],
  ["admin", "calendar"],
  ["leadFollowUps"],
  ["/api/subscriptions/expiring-soon"],
  ["/api/subscriptions/health"],
  ["ops-wall-staff"],
  ["push-logs"],
  ["societies"],
  ["service-locations"],
  ["branches"],
] as const;

export interface SwitchBranchOptions {
  silent?: boolean;
  branchName?: string;
  cityName?: string;
}

export function switchActiveBranch(
  queryClient: QueryClient,
  branchId: number,
  cityId?: number | null,
  options?: SwitchBranchOptions,
): void {
  const currentBranchId = useAppStore.getState().activeBranchId;
  const isDifferent = currentBranchId !== branchId;

  // 1. Update centralized store
  useAppStore.getState().setActiveBranch(branchId, cityId ?? null);

  // 2. Dispatch custom DOM event for decoupled local states to reset
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cwp:branch-changed", {
        detail: {
          branchId,
          cityId: cityId ?? null,
          branchName: options?.branchName,
          cityName: options?.cityName,
        },
      }),
    );
  }

  // 3. Invalidate and refetch all branch-dependent queries
  for (const queryKey of BRANCH_DEPENDENT_QUERY_KEYS) {
    queryClient.invalidateQueries({
      queryKey,
      exact: false,
    });
  }

  // 4. User feedback
  if (!options?.silent && isDifferent && options?.branchName) {
    toast({
      title: `Branch Switched: ${options.branchName}`,
      description: options.cityName
        ? `Viewing operational records for ${options.branchName} (${options.cityName})`
        : `Viewing operational records for ${options.branchName}`,
      duration: 3000,
    });
  }
}
