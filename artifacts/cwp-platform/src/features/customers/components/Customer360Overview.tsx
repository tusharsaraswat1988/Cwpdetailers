import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  MapPin,
  Calendar,
  IndianRupee,
  Wallet,
  Sparkles,
  AlertTriangle,
  LifeBuoy,
  CreditCard,
  Clock,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
} from "lucide-react";
import { operationsApi } from "@/lib/operations/api";

type Props = {
  customerId: number;
  basePath: string;
  customer?: {
    name?: string;
    phone?: string;
    city?: string | null;
    gstin?: string | null;
    billingName?: string | null;
    status?: string;
    customerSince?: string | null;
  };
};

function getStatusBadge(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "active" || s === "resolved") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  }
  if (s === "in_progress" || s === "confirmed" || s === "investigating") {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
        <Clock className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  }
  if (s === "pending" || s === "open" || s === "unassigned") {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  }
  if (s === "cancelled" || s === "failed" || s === "critical") {
    return (
      <Badge className="bg-rose-500/10 text-rose-600 border-rose-200">
        {status}
      </Badge>
    );
  }
  return <Badge variant="outline">{status || "—"}</Badge>;
}

export function Customer360Overview({ customerId, basePath }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "bookings" | "payments" | "support">("overview");

  const {
    data: profileData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["customer-360", customerId],
    queryFn: () => operationsApi.getCustomer360(customerId),
    enabled: customerId > 0,
    staleTime: 30_000,
  });

  const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["customer-bookings-paginated", customerId],
    queryFn: () => operationsApi.getCustomerBookings(customerId, { limit: 20 }),
    enabled: customerId > 0 && activeSubTab === "bookings",
  });

  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ["customer-payments-paginated", customerId],
    queryFn: () => operationsApi.getCustomerPayments(customerId, { limit: 20 }),
    enabled: customerId > 0 && activeSubTab === "payments",
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="customer-360-loading">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const customer = profileData?.customer;
  const stats = profileData?.stats || {
    totalBookings: 0,
    completedBookings: 0,
    totalSpend: 0,
    walletBalance: 0,
    loyaltyPoints: 0,
    activeSubscriptions: 0,
    openComplaints: 0,
    unresolvedExceptions: 0,
  };
  const vehicles = profileData?.vehicles || [];
  const locations = profileData?.savedLocations || [];
  const activeSubs = profileData?.activeSubscriptions || [];
  const recentBookings = profileData?.recentBookings || [];
  const recentPayments = profileData?.recentPayments || [];
  const supportCases = profileData?.supportCases || [];
  const exceptions = profileData?.exceptions || [];

  return (
    <div className="space-y-6" data-testid="customer-360-container">
      {/* Top Controls & Navigation Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeSubTab === "overview" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSubTab("overview")}
            data-testid="subtab-overview"
          >
            Overview & Assets
          </Button>
          <Button
            variant={activeSubTab === "bookings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSubTab("bookings")}
            data-testid="subtab-bookings"
          >
            All Bookings ({stats.totalBookings})
          </Button>
          <Button
            variant={activeSubTab === "payments" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSubTab("payments")}
            data-testid="subtab-payments"
          >
            Payments Ledger
          </Button>
          <Button
            variant={activeSubTab === "support" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSubTab("support")}
            data-testid="subtab-support"
          >
            Support & Exceptions ({stats.openComplaints + stats.unresolvedExceptions})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh 360
          </Button>
          <Link href={`/admin/book-services?customerId=${customerId}`}>
            <Button size="sm" className="text-xs">
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              New Booking
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Lifetime Spend
              </p>
              <h3 className="text-xl font-bold mt-1 text-foreground">
                ₹{Number(stats.totalSpend).toLocaleString("en-IN")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.completedBookings} of {stats.totalBookings} jobs completed
              </p>
            </div>
            <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600">
              <IndianRupee className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Wallet & Loyalty
              </p>
              <h3 className="text-xl font-bold mt-1 text-foreground">
                ₹{Number(stats.walletBalance).toLocaleString("en-IN")}
              </h3>
              <p className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {stats.loyaltyPoints} loyalty points
              </p>
            </div>
            <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-600">
              <Wallet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Active Subscriptions
              </p>
              <h3 className="text-xl font-bold mt-1 text-foreground">
                {stats.activeSubscriptions} Plans
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} linked
              </p>
            </div>
            <div className="p-2.5 rounded-full bg-purple-500/10 text-purple-600">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Active Issues
              </p>
              <h3 className={`text-xl font-bold mt-1 ${stats.openComplaints + stats.unresolvedExceptions > 0 ? "text-rose-600" : "text-foreground"}`}>
                {stats.openComplaints + stats.unresolvedExceptions}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.openComplaints} complaints · {stats.unresolvedExceptions} exceptions
              </p>
            </div>
            <div className={`p-2.5 rounded-full ${stats.openComplaints + stats.unresolvedExceptions > 0 ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SUBTAB: OVERVIEW & ASSETS */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Identity & Branch Metadata Card */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Account Identity & Regional Governance
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Server-side Enforced
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Assigned City / Branch</p>
                <p className="font-medium mt-0.5">
                  {customer?.city || "Unassigned City"} · {customer?.branchName || "No Branch"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer Since</p>
                <p className="font-medium mt-0.5">
                  {customer?.customerSince
                    ? new Date(customer.customerSince).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account Status</p>
                <div className="mt-0.5">{getStatusBadge(customer?.status)}</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">B2B / GSTIN Details</p>
                <p className="font-medium mt-0.5">
                  {customer?.gstin ? (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {customer.gstin}
                    </code>
                  ) : (
                    "Regular Consumer (B2C)"
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Vehicles & Saved Service Locations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vehicles Card */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Car className="w-4 h-4 text-primary" />
                    Saved Vehicles ({vehicles.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Customer registered vehicle assets
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {vehicles.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No vehicles registered for this customer.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vehicles.map((v: any) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            <Car className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {v.make} {v.model}
                              </span>
                              {v.fuelType && (
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {v.fuelType}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {v.registrationNumber || "No Reg Plate"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {v.year && <span>{v.year}</span>}
                          {v.color && <p className="capitalize">{v.color}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved Locations Card */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Saved Service Locations ({locations.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Residential societies, villas, and parking bays
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {locations.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No specific saved locations. Primary address: {customer?.address || "None"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {locations.map((loc: any) => (
                      <div
                        key={loc.id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {loc.name || loc.buildingName || "Location"}
                                </span>
                                {loc.isDefault && (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {[loc.flatNumber || loc.houseNumber, loc.buildingName, loc.area, loc.city]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                              {loc.parkingBay && (
                                <p className="text-[11px] text-primary/80 font-medium mt-1">
                                  Parking Bay: {loc.parkingBay}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active Subscriptions */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Active Cleaning Subscriptions & Maintenance Plans ({activeSubs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {activeSubs.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground">
                    No active recurring cleaning contracts.
                  </p>
                  <Link href={`/admin/book-services?customerId=${customerId}`}>
                    <Button variant="outline" size="sm" className="mt-3 text-xs">
                      Enroll Customer in Daily Cleaning
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSubs.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-lg border border-purple-100 bg-purple-50/30 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">{sub.planName || "Daily Cleaning"}</h4>
                          {getStatusBadge(sub.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Frequency: {sub.frequency || "Daily"} · Time Slot: {sub.timeSlot || "Morning"}
                        </p>
                        {sub.cleanerName && (
                          <p className="text-xs font-medium text-primary mt-2">
                            Assigned Cleaner: {sub.cleanerName}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                        <span>Rate: ₹{sub.monthlyRate || sub.price || "—"}/mo</span>
                        <span>Renews: {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString("en-IN") : "Monthly"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Operations Activity (Bookings & Payments preview) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Recent Bookings
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setActiveSubTab("bookings")}
                >
                  View All <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {recentBookings.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No recent bookings</p>
                ) : (
                  <div className="space-y-2.5">
                    {recentBookings.map((b: any) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border text-xs"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            #{b.id} · {b.serviceName || b.serviceType || "Service"}
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            {b.scheduledDate
                              ? new Date(b.scheduledDate).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}{" "}
                            · ₹{b.totalPrice || 0}
                          </p>
                        </div>
                        <div>{getStatusBadge(b.status)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Recent Transactions
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setActiveSubTab("payments")}
                >
                  View All <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {recentPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No recent payments</p>
                ) : (
                  <div className="space-y-2.5">
                    {recentPayments.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border text-xs"
                      >
                        <div>
                          <p className="font-semibold text-foreground">
                            ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                          </p>
                          <p className="text-muted-foreground mt-0.5 capitalize">
                            {p.paymentMode || "Online"} · {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—"}
                          </p>
                        </div>
                        <div>{getStatusBadge(p.status || "completed")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SUBTAB: ALL BOOKINGS */}
      {activeSubTab === "bookings" && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Customer Booking History</CardTitle>
              <CardDescription className="text-xs">
                Authoritative history of all one-time and recurring service orders
              </CardDescription>
            </div>
            <Link href={`/admin/book-services?customerId=${customerId}`}>
              <Button size="sm" className="text-xs">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Create Booking
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            {isLoadingBookings ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (bookingsData?.data || []).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                No bookings found for this customer.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {(bookingsData?.data || []).map((b: any) => (
                  <div key={b.id} className="p-3 flex items-center justify-between hover:bg-muted/20 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          Booking #{b.id}
                        </span>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {b.serviceType?.replace(/_/g, " ") || "Service"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Scheduled: {b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString("en-IN") : "—"}
                        {b.scheduledTime ? ` at ${b.scheduledTime}` : ""}
                        {b.staffName ? ` · Cleaner: ${b.staffName}` : " · Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-foreground text-sm">₹{b.totalPrice || 0}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{b.paymentStatus || "unpaid"}</p>
                      </div>
                      <div>{getStatusBadge(b.status)}</div>
                      <Link href={`/admin/bookings/${b.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SUBTAB: PAYMENTS LEDGER */}
      {activeSubTab === "payments" && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-base font-semibold">Payments & Transaction Ledger</CardTitle>
            <CardDescription className="text-xs">
              Direct transaction audit trail including gateway references and settlement status
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {isLoadingPayments ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (paymentsData?.data || []).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                No payment transactions recorded for this customer.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {(paymentsData?.data || []).map((p: any) => (
                  <div key={p.id} className="p-3 flex items-center justify-between hover:bg-muted/20 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          ₹{Number(p.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                        {p.refundStatus && p.refundStatus !== "none" && (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
                            {p.refundStatus === "partial" ? "Partially Refunded" : "Refunded"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        Mode: <span className="capitalize font-medium">{p.paymentMode || p.method || "Online"}</span>
                        {p.cfOrderId ? ` · Order: ${p.cfOrderId}` : p.transactionId ? ` · Ref: ${p.transactionId}` : ""}
                        {p.invoiceNumber ? ` · Inv: ${p.invoiceNumber}` : ""}
                        {p.bookingRef ? ` · Booking: ${p.bookingRef}` : ""}
                        {p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>{getStatusBadge(p.status || "completed")}</div>
                      {p.bookingId && (
                        <Link href={`/admin/bookings/${p.bookingId}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View Booking">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SUBTAB: SUPPORT & EXCEPTIONS */}
      {activeSubTab === "support" && (
        <div className="space-y-6">
          {/* Service Exceptions for this customer */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Service Exceptions & Operational Holds ({exceptions.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated flags, delayed executions, and unassigned service jobs
                </CardDescription>
              </div>
              <Link href={`/admin/exceptions?customerId=${customerId}`}>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  Manage in Exceptions Hub <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {exceptions.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">
                  No active service exceptions for this customer.
                </p>
              ) : (
                <div className="space-y-2">
                  {exceptions.map((ex: any) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-lg border border-amber-200 bg-amber-50/20 flex items-start justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{ex.title}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {ex.severity}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1">{ex.reason}</p>
                      </div>
                      <div>{getStatusBadge(ex.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Support Complaints */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-primary" />
                  Customer Support Cases & Complaints ({supportCases.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Logged support inquiries, SLA breaches, and quality disputes
                </CardDescription>
              </div>
              <Link href={`/admin/complaints?customerId=${customerId}`}>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  Open Support Desk <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {supportCases.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">
                  No support cases logged for this customer.
                </p>
              ) : (
                <div className="space-y-2">
                  {supportCases.map((sc: any) => (
                    <div
                      key={sc.id}
                      className="p-3 rounded-lg border flex items-start justify-between text-xs hover:bg-muted/10"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            #{sc.id} · {sc.subject || sc.title || "Support Ticket"}
                          </span>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {sc.category || sc.type || "General"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-2">
                          {sc.description || "No description"}
                        </p>
                      </div>
                      <div className="text-right">
                        <div>{getStatusBadge(sc.status)}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {sc.createdAt ? new Date(sc.createdAt).toLocaleDateString("en-IN") : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
