import { useAccountScope } from "@/lib/account-scope";
import { useListSubscriptions, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { PlanSummaryCard } from "@/components/plans/PlanSummaryCard";
import { activePlans, subscriptionsToPlans, type RawSubscription } from "@/lib/customer-plans";
import { ClipboardList, Phone, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { useBranding } from "@/lib/branding";
import { useQuery } from "@tanstack/react-query";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerErrorState,
  CustomerSkeleton,
  CustomerButton,
  CustomerSupportCard,
  CustomerSubscriptionCard,
} from "@/features/customer-ds";

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
        <CustomerPage>
          <CustomerSkeleton className="h-8 w-48" />
          <CustomerSkeleton className="h-32" />
          <CustomerSkeleton className="h-24" />
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

  const contactPhone = supervisor?.phone ?? branding.supportPhone;
  const contactLabel = supervisor?.name ?? branding.brandName;
  const digits = contactPhone
    ? (contactPhone.replace(/\D/g, "").startsWith("91")
      ? contactPhone.replace(/\D/g, "")
      : `91${contactPhone.replace(/\D/g, "")}`)
    : null;

  return (
    <CustomerLayout>
      <CustomerPage>
        <CustomerHeader
          title="My Plans"
          subtitle="Your service entitlements & usage"
        />

        {isError ? (
          <CustomerErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CustomerSkeleton key={i} className="h-36" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <CustomerEmptyState
            icon={<ClipboardList size={20} />}
            title="No active plans"
            description="Purchase a service plan to get regular cleanings, washes, or AMC visits"
            action={
              <CustomerButton href={CUSTOMER_ROUTES.scheduleEntry({ from: "plans" })} data-testid="btn-explore-services">
                Schedule a Service
              </CustomerButton>
            }
          />
        ) : (
          <div className="space-y-3" data-testid="my-plans-list">
            {plans.map(plan => (
              <CustomerSubscriptionCard key={plan.id}>
                <PlanSummaryCard plan={plan} variant="full" embedded />
              </CustomerSubscriptionCard>
            ))}
          </div>
        )}

        {otherPlans.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plan History
            </h2>
            {otherPlans.map(plan => (
              <CustomerSubscriptionCard key={plan.id}>
                <PlanSummaryCard plan={plan} variant="full" showRenew={false} embedded />
              </CustomerSubscriptionCard>
            ))}
          </section>
        )}

        <CustomerSupportCard
          title="Renew or purchase a plan"
          description={`To renew your plan or purchase a new one, contact ${contactLabel} via WhatsApp or call. We accept cash, UPI, and bank transfer. Your plan is activated after payment confirmation.`}
          actions={
            contactPhone ? (
              <div className="flex gap-2">
                <a
                  href={`tel:${contactPhone}`}
                  className="customer-action-card flex-1 inline-flex items-center justify-center gap-2 h-12 min-h-12 rounded-[var(--customer-radius-sm)] border border-border bg-card text-sm font-medium"
                  data-testid="plan-call-support"
                >
                  <Phone size={15} className="text-green-600" /> Call {contactLabel}
                </a>
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="customer-action-card flex-1 inline-flex items-center justify-center gap-2 h-12 min-h-12 rounded-[var(--customer-radius-sm)] border border-border bg-card text-sm font-medium"
                  data-testid="plan-whatsapp-support"
                >
                  <MessageCircle size={15} className="text-green-600" /> WhatsApp
                </a>
              </div>
            ) : (
              <CustomerButton href={CUSTOMER_ROUTES.support} variant="outline" className="w-full">
                Contact support
              </CustomerButton>
            )
          }
        />

        <CustomerButton href={CUSTOMER_ROUTES.serviceHistory} variant="ghost" className="w-full text-muted-foreground">
          View Service History
        </CustomerButton>
      </CustomerPage>
    </CustomerLayout>
  );
}
