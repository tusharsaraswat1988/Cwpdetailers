import { useAccountScope } from "@/lib/account-scope";
import { useListSubscriptions, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CompletionRing } from "@/components/shared/CompletionRing";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Sun, CreditCard, Pause, Calendar, ArrowRight } from "lucide-react";
import { Link } from "wouter";

type Subscription = {
  id: number;
  type?: string | null;
  status?: string | null;
  serviceName?: string | null;
  endDate?: string | null;
  nextServiceDate?: string | null;
  nextDueDate?: string | null;
  totalServices?: number | null;
  servicesRemaining?: number | null;
  servicesUsed?: number | null;
  dueAmount?: string | number | null;
  vehicleName?: string | null;
};

function isSolarAmc(sub: Subscription) {
  return sub.type === "solar_amc" || sub.type?.includes("solar");
}

function visitsDone(sub: Subscription) {
  if (sub.totalServices != null && sub.servicesRemaining != null) {
    return sub.totalServices - sub.servicesRemaining;
  }
  return sub.servicesUsed ?? 0;
}

function isDailyCleaning(sub: Subscription) {
  return sub.type === "daily_cleaning";
}

function SubscriptionCard({ sub, accent }: { sub: Subscription; accent?: "amber" }) {
  const solar = isSolarAmc(sub);
  const daily = isDailyCleaning(sub);
  const done = visitsDone(sub);
  const remaining = sub.servicesRemaining ?? (sub.totalServices != null ? sub.totalServices - done : null);

  return (
    <Card
      className={accent === "amber" ? "border-amber-500/30 bg-amber-500/5" : undefined}
      data-testid={`services-sub-${sub.id}`}
    >
      <CardContent className="p-4 flex items-start gap-4">
        {sub.totalServices != null && sub.totalServices > 0 ? (
          <CompletionRing value={done} max={sub.totalServices} size={56} label="done" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {solar ? <Sun size={22} className="text-primary" /> : <CreditCard size={22} className="text-primary" />}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm capitalize">{sub.type?.replace(/_/g, " ") ?? "Plan"}</p>
            <StatusBadge status={sub.status ?? "active"} className="shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground">{sub.serviceName}{sub.vehicleName ? ` · ${sub.vehicleName}` : ""}</p>
          {sub.endDate && <p className="text-xs text-muted-foreground">Valid until {sub.endDate}</p>}
          {solar && (
            <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs space-y-0.5">
              <p className="font-medium text-primary">Solar AMC</p>
              {sub.nextServiceDate && <p>Next visit: {sub.nextServiceDate}</p>}
              {sub.totalServices != null && (
                <p>{done} visits done · {remaining ?? "—"} remaining</p>
              )}
            </div>
          )}
          {!solar && daily && (
            <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs space-y-1">
              <p className="font-medium text-primary">Daily Car Cleaning</p>
              {sub.totalServices != null && (
                <p>{done} visits done · {remaining ?? "—"} remaining</p>
              )}
              <Link href="/customer/daily-cleaning" className="text-primary hover:underline inline-flex items-center gap-1">
                Open plan <ArrowRight size={11} />
              </Link>
            </div>
          )}
          {!solar && !daily && sub.nextServiceDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar size={11} /> Next: {sub.nextServiceDate}
            </p>
          )}
          {Number(sub.dueAmount) > 0 && (
            <p className="text-xs text-destructive font-medium">₹{Number(sub.dueAmount).toLocaleString("en-IN")} due</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerServices() {
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data, isLoading, isError, refetch } = useListSubscriptions(
    { customerId: String(customerId ?? "") } as any,
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as any),
        enabled: customerId != null,
      },
    },
  );

  const all = (data?.data ?? []) as Subscription[];
  const active = all.filter(s => s.status === "active");
  const paused = all.filter(s => s.status === "paused");
  const other = all.filter(s => s.status !== "active" && s.status !== "paused");

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a customer profile. Contact CWP support.</p>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl">My Services</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isLoading ? "" : `${active.length} active plan${active.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/customer/bookings">
            <Button size="sm" className="gap-1 shrink-0">
              Book <ArrowRight size={14} />
            </Button>
          </Link>
        </div>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : active.length === 0 && paused.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={20} />}
            title="No active services"
            description="Book a daily wash, package, or solar AMC to get started"
            action={
              <Link href="/customer/bookings">
                <Button>Book a Service</Button>
              </Link>
            }
          />
        ) : (
          <>
            {active.length > 0 && (
              <section data-testid="services-active-section">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Active</h2>
                <div className="space-y-3">
                  {active.map(sub => <SubscriptionCard key={sub.id} sub={sub} />)}
                </div>
              </section>
            )}

            {paused.length > 0 && (
              <section data-testid="services-paused-section">
                <div className="flex items-center gap-2 mb-2">
                  <Pause size={14} className="text-amber-600" />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Paused — low balance</h2>
                </div>
                <div className="space-y-3">
                  {paused.map(sub => <SubscriptionCard key={sub.id} sub={sub} accent="amber" />)}
                </div>
                <Link href="/customer/wallet" className="block mt-3">
                  <Button variant="outline" size="sm" className="w-full">Recharge wallet</Button>
                </Link>
              </section>
            )}

            {other.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Other</h2>
                <div className="space-y-3">
                  {other.map(sub => <SubscriptionCard key={sub.id} sub={sub} />)}
                </div>
              </section>
            )}
          </>
        )}

        <Link href="/customer/assets">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
            Manage vehicles & solar sites
          </Button>
        </Link>
      </div>
    </CustomerLayout>
  );
}
