import { useAccountScope } from "@/lib/account-scope";
import { useGetCustomerSummary, getGetCustomerSummaryQueryKey, useListSubscriptions, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ArrowRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ActivityFeed } from "@/components/shared/ActivityFeed";
import { CompletionRing } from "@/components/shared/CompletionRing";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DcmsHomeCard } from "@/features/daily-cleaning/pages/CustomerDailyCleaningPage";

async function fetchWalletTransactions(customerId: number) {
  const res = await fetch(`/api/customers/${customerId}/wallet/transactions?limit=5`, { credentials: "include" });
  if (!res.ok) return { data: [] };
  return res.json();
}

async function fetchWalletSummary(customerId: number) {
  const res = await fetch(`/api/customers/${customerId}/wallet`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export default function CustomerDashboard() {
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data: summary, isLoading } = useGetCustomerSummary(customerId ?? 0, {
    query: {
      queryKey: getGetCustomerSummaryQueryKey(customerId ?? 0),
      enabled: customerId != null,
    }
  });

  const { data: subs } = useListSubscriptions({ customerId: String(customerId ?? "") } as any, {
    query: {
      queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as any),
      enabled: customerId != null,
    }
  });

  const { data: walletTx } = useQuery({
    queryKey: ["customer-wallet-tx", customerId],
    queryFn: () => fetchWalletTransactions(customerId!),
    enabled: customerId != null,
  });

  const { data: walletSummary } = useQuery({
    queryKey: ["customer-wallet-summary", customerId],
    queryFn: () => fetchWalletSummary(customerId!),
    enabled: customerId != null,
  });

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <div className="p-6"><Skeleton className="h-8 w-48" /></div>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="p-6 max-w-md mx-auto text-center space-y-2">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a customer profile. Contact CWP support.</p>
        </div>
      </CustomerLayout>
    );
  }

  const upcomingBooking = (summary?.recentBookings ?? []).find(
    (b: { status?: string }) => b.status === "scheduled" || b.status === "en_route" || b.status === "in_progress",
  );

  const activityItems = (summary?.recentBookings ?? []).slice(0, 5).map((b: { id: number; serviceType?: string; scheduledDate?: string; status?: string }) => ({
    id: b.id,
    icon: Calendar,
    iconColor: "text-primary",
    title: (b.serviceType ?? "Service").replace(/_/g, " "),
    subtitle: b.status?.replace(/_/g, " "),
    timestamp: b.scheduledDate,
  }));

  const statChips = [
    { label: "Wallet", value: `₹${(summary?.walletBalance ?? 0).toLocaleString("en-IN")}`, color: "text-green-600" },
    { label: "Active Plans", value: String(summary?.activeSubscriptions ?? 0), color: "text-primary" },
    { label: "Due", value: `₹${(summary?.pendingDues ?? 0).toLocaleString("en-IN")}`, color: "text-amber-600" },
  ];

  return (
    <CustomerLayout>
      <div className="space-y-5">
        {/* Next service hero */}
        {isLoading ? (
          <Skeleton className="h-36 w-full rounded-2xl" />
        ) : upcomingBooking ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card overflow-hidden" data-testid="next-service-hero">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Next Service</p>
                  <StatusBadge status={upcomingBooking.status ?? "scheduled"} pulse={upcomingBooking.status === "in_progress" || upcomingBooking.status === "en_route"} />
                </div>
                <div>
                  <p className="font-display font-bold text-lg capitalize leading-tight">
                    {(upcomingBooking.serviceType ?? "Service").replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {upcomingBooking.scheduledDate}
                    {upcomingBooking.scheduledTime ? ` · ${upcomingBooking.scheduledTime}` : ""}
                  </p>
                </div>
                <Link href="/customer/history">
                  <Button size="sm" variant="outline" className="w-full h-11">
                    View details <ArrowRight size={14} className="ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-dashed" data-testid="no-upcoming-hero">
              <CardContent className="p-4 text-center space-y-3">
                <p className="font-medium text-sm">No upcoming services</p>
                <p className="text-xs text-muted-foreground">Book your next wash or cleaning in one tap</p>
                <Link href="/customer/bookings">
                  <Button className="w-full h-11">Book a Service</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Compact stat chips */}
        <div className="grid grid-cols-3 gap-2">
          {statChips.map((chip) => (
            <div key={chip.label} className="rounded-xl border border-border bg-card p-3 text-center" data-testid={`stat-chip-${chip.label.toLowerCase()}`}>
              {isLoading ? (
                <Skeleton className="h-5 w-12 mx-auto mb-1" />
              ) : (
                <p className={`font-display font-bold text-base tabular-nums ${chip.color}`}>{chip.value}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">{chip.label}</p>
            </div>
          ))}
        </div>

        {/* Wallet */}
        <div>
          <h2 className="font-semibold text-base mb-3">Wallet</h2>
          <Card data-testid="customer-wallet-section">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current balance</p>
                  <p className="text-xl font-bold text-green-600">
                    ₹{(summary?.walletBalance ?? 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground max-w-[160px] text-right">
                  Contact CWP to recharge your wallet (cash / UPI / bank transfer)
                </p>
              </div>
              {(walletTx?.data ?? []).length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Recent transactions</p>
                  {(walletTx?.data ?? []).map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between text-sm" data-testid={`wallet-tx-${tx.id}`}>
                      <div className="flex items-center gap-2">
                        {tx.type === "credit" ? (
                          <ArrowDownLeft size={14} className="text-green-500" />
                        ) : (
                          <ArrowUpRight size={14} className="text-red-400" />
                        )}
                        <div>
                          <span className="capitalize font-medium">{tx.type}</span>
                          <p className="text-xs text-muted-foreground">
                            {tx.reference?.replace(/_/g, " ") ?? "—"} · {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <span className={tx.type === "credit" ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                        {tx.type === "credit" ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Cleaning (DCMS) */}
        <DcmsHomeCard />

        {/* Active subscriptions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">Active Plans</h2>
            <Link href="/customer/history" className="text-primary text-sm hover:underline flex items-center gap-1">
              View history <ArrowRight size={13} />
            </Link>
          </div>
          <div className="space-y-3">
            {(subs?.data ?? []).filter(s => s.status === "active" || s.status === "paused").slice(0, 3).map(sub => (
              <Card key={sub.id} data-testid={`sub-card-${sub.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  {sub.totalServices != null && (
                    <CompletionRing
                      value={sub.totalServices - (sub.servicesRemaining ?? 0)}
                      max={sub.totalServices}
                      size={48}
                      label="done"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm capitalize">{sub.type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub.serviceName} · Expires {sub.endDate}</p>
                    {sub.nextDueDate && <p className="text-xs text-muted-foreground">Next due: {sub.nextDueDate}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={sub.status ?? "active"} />
                    {Number(sub.dueAmount) > 0 && (
                      <p className="text-xs text-destructive mt-1">₹{Number(sub.dueAmount).toLocaleString("en-IN")} due</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(subs?.data ?? []).filter(s => s.status === "active" || s.status === "paused").length === 0 && (
              <div className="text-center py-8 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground text-sm mb-3">No active subscriptions</p>
                <Link href="/customer/bookings">
                  <Button size="sm" className="bg-primary text-secondary hover:bg-primary/90">Book a Service</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity feed */}
        {activityItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-base">Recent Activity</h2>
              <Link href="/customer/history" className="text-primary text-xs hover:underline flex items-center gap-1">
                See all <ArrowRight size={12} />
              </Link>
            </div>
            <Card>
              <CardContent className="p-4 pt-2">
                <ActivityFeed items={activityItems} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
