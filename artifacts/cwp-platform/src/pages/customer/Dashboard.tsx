import { useAuth } from "@/lib/auth";
import { useAccountScope } from "@/lib/account-scope";
import { useGetCustomerSummary, getGetCustomerSummaryQueryKey, useListSubscriptions, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CreditCard, AlertCircle, IndianRupee, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function CustomerDashboard() {
  const { user } = useAuth();
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

  const stats = [
    { label: "Active Plans", value: summary?.activeSubscriptions ?? 0, icon: CreditCard, color: "text-primary" },
    { label: "Upcoming Services", value: summary?.upcomingServices ?? 0, icon: Calendar, color: "text-blue-500" },
    { label: "Wallet Balance", value: `₹${(summary?.walletBalance ?? 0).toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-green-500" },
    { label: "Pending Dues", value: `₹${(summary?.pendingDues ?? 0).toLocaleString("en-IN")}`, icon: AlertCircle, color: "text-amber-500" },
  ];

  return (
    <CustomerLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="font-display font-bold text-2xl">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Here's what's happening with your vehicles and panels today.</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }}>
              <Card data-testid={`customer-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <s.icon size={16} className={s.color} />
                  </div>
                  {isLoading ? <Skeleton className="h-6 w-16 mb-1" /> : <p className={`font-display font-bold text-xl ${s.color}`}>{s.value}</p>}
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

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
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm capitalize">{sub.type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{sub.serviceName} · Expires {sub.endDate}</p>
                    {sub.nextDueDate && <p className="text-xs text-muted-foreground">Next due: {sub.nextDueDate}</p>}
                    {sub.totalServices != null && (
                      <p className="text-xs text-muted-foreground">{sub.servicesRemaining ?? 0}/{sub.totalServices} services remaining</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-xs ${sub.status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"}`}>
                      {sub.status}
                    </Badge>
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

        {/* Recent activity */}
        {(summary?.recentBookings ?? []).length > 0 && (
          <div>
            <h2 className="font-semibold text-base mb-3">Recent Services</h2>
            <div className="space-y-2">
              {(summary?.recentBookings ?? []).slice(0, 4).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border" data-testid={`recent-booking-${b.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar size={13} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{b.serviceType?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{b.scheduledDate}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{b.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
