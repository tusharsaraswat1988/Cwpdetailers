import { useMemo } from "react";
import { Redirect, useParams } from "wouter";
import { useListSubscriptions, getListSubscriptionsQueryKey, useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { PlanProgressBar } from "@/components/plans/PlanProgressBar";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { subscriptionToPlan, type RawSubscription } from "@/lib/customer-plans";
import { planEligibleForSchedule } from "@/lib/schedule-entry";
import {
  ArrowLeft, Calendar, Car, FileText, HelpCircle, RefreshCw, ClipboardList, ArrowRight,
} from "lucide-react";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerSkeleton,
  CustomerButton,
  CustomerSubscriptionCard,
  CustomerCard,
  CustomerStatusBadge,
} from "@/features/customer-ds";

function planStatusForBadge(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "active",
    PAUSED: "paused",
    EXPIRED: "cancelled",
    COMPLETED: "completed",
    RENEWAL_DUE: "scheduled",
    PENDING_ACTIVATION: "scheduled",
  };
  return map[status] ?? "active";
}

export default function PlanDetail() {
  const params = useParams<{ id: string }>();
  const planId = parseInt(params.id ?? "", 10);
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data: subsData, isLoading: subsLoading } = useListSubscriptions(
    { customerId: String(customerId ?? "") } as Parameters<typeof useListSubscriptions>[0],
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as Parameters<typeof getListSubscriptionsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );

  const { data: bookingsData, isLoading: bookingsLoading } = useListBookings(
    { customerId: String(customerId ?? "") } as Parameters<typeof useListBookings>[0],
    {
      query: {
        queryKey: getListBookingsQueryKey({ customerId: String(customerId ?? "") } as Parameters<typeof getListBookingsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );

  const rawSub = useMemo(
    () => (subsData?.data ?? []).find(s => s.id === planId) as RawSubscription | undefined,
    [subsData, planId],
  );

  const plan = rawSub ? subscriptionToPlan(rawSub) : null;

  const usageHistory = useMemo(() => {
    const bookings = bookingsData?.data ?? [];
    return bookings
      .filter(b => b.status === "completed" || b.status === "in_progress" || b.status === "scheduled")
      .slice(0, 20);
  }, [bookingsData]);

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <CustomerPage>
          <CustomerSkeleton className="h-8 w-48" />
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

  if (subsLoading) {
    return (
      <CustomerLayout>
        <CustomerPage>
          <CustomerSkeleton className="h-8 w-48" />
          <CustomerSkeleton className="h-40" />
          <CustomerSkeleton className="h-24" />
        </CustomerPage>
      </CustomerLayout>
    );
  }

  if (!plan) {
    return (
      <CustomerLayout>
        <CustomerPage>
          <CustomerEmptyState
            icon={<ClipboardList size={20} />}
            title="Plan not found"
            description="This plan may have been removed or you don't have access"
            action={
              <CustomerButton href={CUSTOMER_ROUTES.plans} variant="outline">
                Back to My Plans
              </CustomerButton>
            }
          />
        </CustomerPage>
      </CustomerLayout>
    );
  }

  if (plan.isDailyCleaning) {
    return <Redirect to="/customer/daily-cleaning" />;
  }

  return (
    <CustomerLayout>
      <CustomerPage>
        <div>
          <CustomerButton href={CUSTOMER_ROUTES.plans} variant="ghost" size="sm" className="-ml-2 mb-2">
            <ArrowLeft size={14} className="mr-1" /> My Plans
          </CustomerButton>
          <CustomerHeader
            title={plan.name}
            subtitle={plan.type.replace(/_/g, " ")}
            actions={
              <CustomerStatusBadge
                status={planStatusForBadge(plan.status)}
                label={plan.displayStatus}
              />
            }
          />
        </div>

        <div data-testid="plan-summary">
          <CustomerSubscriptionCard>
            <h2 className="font-semibold text-sm mb-4">Plan Summary</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Remaining Services</p>
                <p className="font-bold text-lg text-green-700">{plan.totalRemaining}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plan Expiry</p>
                <p className="font-medium">{plan.expiryDate ?? "—"}</p>
              </div>
            </div>
            {plan.totalAllocated > 0 && (
              <div className="mt-4">
                <PlanProgressBar
                  used={plan.totalUsed}
                  total={plan.totalAllocated}
                  label="Usage Progress"
                />
              </div>
            )}
          </CustomerSubscriptionCard>
        </div>

        {plan.serviceLines.length > 0 && (
          <CustomerSubscriptionCard>
            <h2 className="font-semibold text-sm mb-3">Included Services</h2>
            <div className="space-y-3">
              {plan.serviceLines.map(line => (
                <div key={line.label} className="flex justify-between text-sm">
                  <span>{line.label}</span>
                  <span className="font-medium tabular-nums">
                    {line.remaining} / {line.total} Remaining
                  </span>
                </div>
              ))}
            </div>
          </CustomerSubscriptionCard>
        )}

        {plan.vehicleOrSite && (
          <CustomerCard>
            <div className="flex items-center gap-3">
              <Car size={18} className="text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vehicle / Solar Site</p>
                <p className="font-medium text-sm">{plan.vehicleOrSite}</p>
              </div>
            </div>
          </CustomerCard>
        )}

        {plan.nextVisitDate && (
          <CustomerCard>
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Next Scheduled Visit</p>
                <p className="font-medium text-sm">{plan.nextVisitDate}</p>
              </div>
            </div>
          </CustomerCard>
        )}

        <div>
          <h2 className="font-semibold text-base mb-3">Service History</h2>
          {bookingsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <CustomerSkeleton key={i} className="h-16" />)}
            </div>
          ) : usageHistory.length === 0 ? (
            <CustomerEmptyState
              icon={<Calendar size={20} />}
              title="No usage yet"
              description="Services used under this plan will appear here"
            />
          ) : (
            <div className="space-y-2">
              {usageHistory.map(b => (
                <div key={b.id} data-testid={`usage-${b.id}`}>
                  <CustomerCard>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm capitalize">
                          {(b.serviceType ?? "Service").replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.scheduledDate}
                          {b.vehicleName ? ` · ${b.vehicleName}` : ""}
                        </p>
                        {b.staffName && (
                          <p className="text-xs text-muted-foreground">Staff: {b.staffName}</p>
                        )}
                      </div>
                      <CustomerStatusBadge status={b.status ?? "scheduled"} />
                    </div>
                  </CustomerCard>
                </div>
              ))}
            </div>
          )}
        </div>

        {planEligibleForSchedule(plan) && !plan.isDailyCleaning && (
          <CustomerButton
            href={CUSTOMER_ROUTES.scheduleEntry({ planId: plan.id, from: "plans" })}
            className="w-full gap-2"
            data-testid="btn-schedule-from-plan-detail"
          >
            Schedule Next Visit <ArrowRight size={15} />
          </CustomerButton>
        )}

        <div className="grid grid-cols-2 gap-2">
          {plan.canRenew && (
            <CustomerButton href={CUSTOMER_ROUTES.support} variant="outline" className="w-full gap-1.5">
              <RefreshCw size={14} /> Renew Plan
            </CustomerButton>
          )}
          <CustomerButton href={CUSTOMER_ROUTES.invoices} variant="outline" className="w-full gap-1.5">
            <FileText size={14} /> Invoices
          </CustomerButton>
          <CustomerButton href={CUSTOMER_ROUTES.support} variant="ghost" className="w-full gap-1.5 col-span-2">
            <HelpCircle size={14} /> Support
          </CustomerButton>
        </div>
      </CustomerPage>
    </CustomerLayout>
  );
}
