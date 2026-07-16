import { useMemo } from "react";
import { Link, Redirect, useParams } from "wouter";
import { useListSubscriptions, getListSubscriptionsQueryKey, useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PlanProgressBar } from "@/components/plans/PlanProgressBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { subscriptionToPlan, type RawSubscription } from "@/lib/customer-plans";
import { planEligibleForSchedule } from "@/lib/schedule-entry";
import {
  ArrowLeft, Calendar, Car, FileText, HelpCircle, RefreshCw, ClipboardList, ArrowRight,
} from "lucide-react";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";

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
        <Skeleton className="h-8 w-48" />
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

  if (subsLoading) {
    return (
      <CustomerLayout>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </CustomerLayout>
    );
  }

  if (!plan) {
    return (
      <CustomerLayout>
        <EmptyState
          icon={<ClipboardList size={20} />}
          title="Plan not found"
          description="This plan may have been removed or you don't have access"
          action={
            <Link href={CUSTOMER_ROUTES.plans}>
              <Button variant="outline">Back to My Plans</Button>
            </Link>
          }
        />
      </CustomerLayout>
    );
  }

  if (plan.isDailyCleaning) {
    return <Redirect to="/customer/daily-cleaning" />;
  }

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div>
          <Link href={CUSTOMER_ROUTES.plans}>
            <Button variant="ghost" size="sm" className="-ml-2 mb-2">
              <ArrowLeft size={14} className="mr-1" /> My Plans
            </Button>
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display font-bold text-2xl">{plan.name}</h1>
              <p className="text-muted-foreground text-sm mt-0.5 capitalize">
                {plan.type.replace(/_/g, " ")}
              </p>
            </div>
            <StatusBadge
              status={planStatusForBadge(plan.status)}
              label={plan.displayStatus}
            />
          </div>
        </div>

        {/* Plan Summary */}
        <Card data-testid="plan-summary">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold text-sm">Plan Summary</h2>
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
              <PlanProgressBar
                used={plan.totalUsed}
                total={plan.totalAllocated}
                label="Usage Progress"
              />
            )}
          </CardContent>
        </Card>

        {/* Included Services */}
        {plan.serviceLines.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold text-sm">Included Services</h2>
              {plan.serviceLines.map(line => (
                <div key={line.label} className="flex justify-between text-sm">
                  <span>{line.label}</span>
                  <span className="font-medium tabular-nums">
                    {line.remaining} / {line.total} Remaining
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Vehicle / Site */}
        {plan.vehicleOrSite && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Car size={18} className="text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vehicle / Solar Site</p>
                <p className="font-medium text-sm">{plan.vehicleOrSite}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Visits */}
        {plan.nextVisitDate && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar size={18} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Next Scheduled Visit</p>
                <p className="font-medium text-sm">{plan.nextVisitDate}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service History */}
        <div>
          <h2 className="font-semibold text-base mb-3">Service History</h2>
          {bookingsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : usageHistory.length === 0 ? (
            <EmptyState
              icon={<Calendar size={20} />}
              title="No usage yet"
              description="Services used under this plan will appear here"
            />
          ) : (
            <div className="space-y-2">
              {usageHistory.map(b => (
                <Card key={b.id} data-testid={`usage-${b.id}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
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
                    <StatusBadge status={b.status ?? "scheduled"} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {planEligibleForSchedule(plan) && !plan.isDailyCleaning && (
          <Link href={CUSTOMER_ROUTES.scheduleEntry({ planId: plan.id, from: "plans" })}>
            <Button className="w-full h-11 gap-2" data-testid="btn-schedule-from-plan-detail">
              Schedule Next Visit <ArrowRight size={15} />
            </Button>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-2">
          {plan.canRenew && (
            <Link href={CUSTOMER_ROUTES.support}>
              <Button variant="outline" className="w-full gap-1.5">
                <RefreshCw size={14} /> Renew Plan
              </Button>
            </Link>
          )}
          <Link href={CUSTOMER_ROUTES.invoices}>
            <Button variant="outline" className="w-full gap-1.5">
              <FileText size={14} /> Invoices
            </Button>
          </Link>
          <Link href={CUSTOMER_ROUTES.support}>
            <Button variant="ghost" className="w-full gap-1.5 col-span-2">
              <HelpCircle size={14} /> Support
            </Button>
          </Link>
        </div>
      </div>
    </CustomerLayout>
  );
}
