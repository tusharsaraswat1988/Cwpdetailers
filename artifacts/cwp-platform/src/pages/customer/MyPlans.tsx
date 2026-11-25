import { useMemo } from "react";
import { useAccountScope } from "@/lib/account-scope";
import { useListSubscriptions, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { PlanSummaryCard } from "@/components/plans/PlanSummaryCard";
import { activePlans, subscriptionsToPlans, type RawSubscription, type CustomerPlan } from "@/lib/customer-plans";
import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { useBranding } from "@/lib/branding";
import { useQuery } from "@tanstack/react-query";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { cn } from "@/lib/utils";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerErrorState,
  CustomerSkeleton,
  CustomerButton,
  CustomerSupportCard,
} from "@/features/customer-ds";

type PlanGroup = {
  groupKey: string;
  groupTitle: string;
  kind: "vehicle" | "solar" | "general";
  plans: CustomerPlan[];
};

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
    s.status !== "active" && s.status !== "paused" && s.status !== "expiring" && s.status !== "pending_payment",
  ));

  const planGroups = useMemo<PlanGroup[]>(() => {
    const groups: Record<string, PlanGroup> = {};
    for (const plan of plans) {
      const isSolar = plan.type.includes("solar") || Boolean(plan.solarSiteId);
      const key = plan.vehicleOrSite
        ? `${isSolar ? "solar" : "vehicle"}_${plan.vehicleOrSite}`
        : "general";
      const title = plan.vehicleOrSite || "General Service Entitlements";
      const kind = isSolar ? "solar" : plan.vehicleOrSite ? "vehicle" : "general";

      if (!groups[key]) {
        groups[key] = { groupKey: key, groupTitle: title, kind, plans: [] };
      }
      groups[key].plans.push(plan);
    }
    return Object.values(groups);
  }, [plans]);

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
          subtitle="Your vehicle-organized service entitlements & visit quotas"
        />

        {isError ? (
          <CustomerErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CustomerSkeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <CustomerEmptyState
            icon={<MaterialSymbol name="assignment" size={24} className="text-primary" />}
            title="No active plans"
            description="Purchase a service plan to get regular cleanings, washes, or AMC visits"
            action={
              <CustomerButton href={CUSTOMER_ROUTES.scheduleEntry({ from: "plans" })} data-testid="btn-explore-services">
                Schedule a Service
              </CustomerButton>
            }
          />
        ) : (
          <div className="space-y-6" data-testid="my-plans-list">
            {planGroups.map(group => (
              <div key={group.groupKey} className="space-y-3">
                {/* Vehicle / Asset Group Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        group.kind === "solar"
                          ? "bg-amber-50 text-amber-600"
                          : group.kind === "vehicle"
                          ? "bg-blue-50 text-primary"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      <MaterialSymbol
                        name={group.kind === "solar" ? "wb_sunny" : group.kind === "vehicle" ? "directions_car" : "inventory_2"}
                        size={16}
                      />
                    </div>
                    <h2 className="text-sm font-bold text-foreground font-display truncate">
                      {group.groupTitle}
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-slate-100 px-2.5 py-0.5 rounded-full tabular-nums shrink-0">
                    {group.plans.length} {group.plans.length === 1 ? "Active Plan" : "Active Plans"}
                  </span>
                </div>

                {/* Subscriptions for this asset */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.plans.map(plan => (
                    <PlanSummaryCard key={plan.id} plan={plan} variant="full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {otherPlans.length > 0 && (
          <section className="space-y-3 pt-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Plan History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherPlans.map(plan => (
                <PlanSummaryCard key={plan.id} plan={plan} variant="full" showRenew={false} />
              ))}
            </div>
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
                  className="customer-action-card flex-1 inline-flex items-center justify-center gap-2 h-12 min-h-12 rounded-[var(--customer-radius-sm)] border border-border bg-card text-sm font-medium hover:bg-slate-50 transition-colors"
                  data-testid="plan-call-support"
                >
                  <MaterialSymbol name="call" size={16} className="text-green-600" /> Call {contactLabel}
                </a>
                <a
                  href={`https://wa.me/${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="customer-action-card flex-1 inline-flex items-center justify-center gap-2 h-12 min-h-12 rounded-[var(--customer-radius-sm)] border border-border bg-card text-sm font-medium hover:bg-slate-50 transition-colors"
                  data-testid="plan-whatsapp-support"
                >
                  <MaterialSymbol name="chat" size={16} className="text-green-600" /> WhatsApp
                </a>
              </div>
            ) : (
              <CustomerButton href={CUSTOMER_ROUTES.support} variant="outline" className="w-full">
                Contact support
              </CustomerButton>
            )
          }
        />

        <CustomerButton href={CUSTOMER_ROUTES.serviceHistory} variant="ghost" className="w-full text-muted-foreground gap-1.5">
          <MaterialSymbol name="history" size={16} /> View Service History
        </CustomerButton>
      </CustomerPage>
    </CustomerLayout>
  );
}
