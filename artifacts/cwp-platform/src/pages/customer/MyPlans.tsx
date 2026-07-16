import { useAccountScope } from "@/lib/account-scope";
import { useListSubscriptions, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PlanSummaryCard } from "@/components/plans/PlanSummaryCard";
import { activePlans, subscriptionsToPlans, type RawSubscription } from "@/lib/customer-plans";
import { ClipboardList, Phone, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { useBranding } from "@/lib/branding";
import { useQuery } from "@tanstack/react-query";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";

export default function CustomerMyPlans() {
  const branding = useBranding();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data, isLoading, isError, refetch } = useListSubscriptions(
    { customerId: String(customerId ?? "") } as Parameters<typeof useListSubscriptions>[0],
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as Parameters<typeof getListSubscriptionsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );

  const { data: supervisorData } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "customer-supervisor"],
    queryFn: staffEcosystemApi.getCustomerSupervisorContact,
    enabled: customerId != null,
  });
  const supervisor = supervisorData?.supervisor;

  const allSubs = (data?.data ?? []) as RawSubscription[];
  const plans = activePlans(allSubs);
  const otherPlans = subscriptionsToPlans(allSubs.filter(s =>
    s.status !== "active" && s.status !== "paused" && s.status !== "expiring",
  ));

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
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

  const contactPhone = supervisor?.phone ?? branding.supportPhone;
  const contactLabel = supervisor?.name ?? branding.brandName;
  const digits = contactPhone
    ? (contactPhone.replace(/\D/g, "").startsWith("91")
      ? contactPhone.replace(/\D/g, "")
      : `91${contactPhone.replace(/\D/g, "")}`)
    : null;

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">My Plans</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Your service entitlements &amp; usage
          </p>
        </div>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={20} />}
            title="No active plans"
            description="Purchase a service plan to get regular cleanings, washes, or AMC visits"
            action={
              <Link href={CUSTOMER_ROUTES.scheduleEntry({ from: "plans" })}>
                <Button data-testid="btn-explore-services">Schedule a Service</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3" data-testid="my-plans-list">
            {plans.map(plan => (
              <PlanSummaryCard key={plan.id} plan={plan} variant="full" />
            ))}
          </div>
        )}

        {otherPlans.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Plan History
            </h2>
            <div className="space-y-3">
              {otherPlans.map(plan => (
                <PlanSummaryCard key={plan.id} plan={plan} variant="full" showRenew={false} />
              ))}
            </div>
          </section>
        )}

        <Card className="bg-muted/30" data-testid="plan-renew-info">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-sm">Renew or purchase a plan</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To renew your plan or purchase a new one, contact {contactLabel} via WhatsApp or call.
              We accept cash, UPI, and bank transfer. Your plan is activated after payment confirmation.
            </p>
            {contactPhone ? (
              <div className="flex gap-2">
                <a
                  href={`tel:${contactPhone}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
                  data-testid="plan-call-support"
                >
                  <Phone size={15} className="text-green-600" /> Call {contactLabel}
                </a>
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
                  data-testid="plan-whatsapp-support"
                >
                  <MessageCircle size={15} className="text-green-600" /> WhatsApp
                </a>
              </div>
            ) : (
              <Link href={CUSTOMER_ROUTES.support}>
                <Button variant="outline" size="sm" className="w-full">Contact support</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <Link href={CUSTOMER_ROUTES.serviceHistory}>
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
            View Service History
          </Button>
        </Link>
      </div>
    </CustomerLayout>
  );
}
