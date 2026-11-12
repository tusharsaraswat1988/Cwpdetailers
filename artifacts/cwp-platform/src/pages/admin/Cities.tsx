import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Building2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Activity,
  FileText,
  Search,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Users,
  CreditCard,
  Briefcase,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export type CityItem = {
  id: number;
  stateId: number;
  name: string;
  slug: string;
  code: string | null;
  status: "draft" | "setup_in_progress" | "ready_for_launch" | "active" | "suspended" | "archived";
  timezone: string;
  currency: string;
  locale: string;
  contactPhone: string | null;
  contactEmail: string | null;
  operationalSettings: Record<string, unknown>;
  contentSettings: Record<string, unknown>;
  launchedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  archivedAt: string | null;
  isActive: boolean;
  createdAt: string;
  stateName: string;
  stateCode: string;
};

export type CityChecklistItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  passed: boolean;
  details: string;
  critical: boolean;
};

export type CityReadinessReport = {
  cityId: number;
  cityName: string;
  cityCode: string | null;
  status: string;
  isReady: boolean;
  score: number;
  passedCount: number;
  totalCount: number;
  checklist: CityChecklistItem[];
  blockingReasons: string[];
};

export type CityOperationsDashboard = {
  cityId: number;
  cityName: string;
  cityCode: string | null;
  status: string;
  activeBranchesCount: number;
  totalBranchesCount: number;
  activeStaffCount: number;
  activeSupervisorsCount: number;
  activeCustomersCount: number;
  activeDcmsSubscriptionsCount: number;
  todayJobsScheduled: number;
  todayJobsCompleted: number;
  todayCompletionRate: number;
  monthlyCollections: number;
};

export default function AdminCities() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [readinessCity, setReadinessCity] = useState<CityItem | null>(null);
  const [dashboardCity, setDashboardCity] = useState<CityItem | null>(null);
  const [suspendCityTarget, setSuspendCityTarget] = useState<CityItem | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Form state
  const [newName, setNewName] = useState("");
  const [newStateId, setNewStateId] = useState<string>("");
  const [newCode, setNewCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // 1. Fetch cities
  const {
    data: cities = [],
    isLoading: citiesLoading,
    refetch: refetchCities,
  } = useQuery<CityItem[]>({
    queryKey: ["admin", "cities", statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery) params.append("q", searchQuery);
      params.append("includeAll", "true");

      const res = await fetch(`/api/cities?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load cities");
      return res.json();
    },
  });

  // 2. Fetch states for creation
  const { data: states = [] } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["masters", "states"],
    queryFn: async () => {
      const res = await fetch("/api/masters/states?isActive=true", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 3. Readiness Query
  const {
    data: readinessReport,
    isLoading: readinessLoading,
    refetch: refetchReadiness,
  } = useQuery<CityReadinessReport>({
    queryKey: ["admin", "cities", readinessCity?.id, "readiness"],
    queryFn: async () => {
      if (!readinessCity) return null as any;
      const res = await fetch(`/api/cities/${readinessCity.id}/readiness`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to evaluate city readiness");
      return res.json();
    },
    enabled: !!readinessCity,
  });

  // 4. Operations Dashboard Query
  const { data: operationsMetrics, isLoading: dashboardLoading } = useQuery<CityOperationsDashboard>({
    queryKey: ["admin", "cities", dashboardCity?.id, "dashboard"],
    queryFn: async () => {
      if (!dashboardCity) return null as any;
      const res = await fetch(`/api/cities/${dashboardCity.id}/operations-dashboard`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load city operational metrics");
      return res.json();
    },
    enabled: !!dashboardCity,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          stateId: Number(newStateId),
          code: newCode.trim().toUpperCase() || undefined,
          contactPhone: newPhone.trim() || undefined,
          contactEmail: newEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create city");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "City Created", description: "City has been added in setup mode." });
      setCreateOpen(false);
      setNewName("");
      setNewCode("");
      setNewStateId("");
      setNewPhone("");
      setNewEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin", "cities"] });
    },
    onError: (err: any) => {
      toast({ title: "Creation Failed", description: err.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ cityId, force }: { cityId: number; force?: boolean }) => {
      const res = await fetch(`/api/cities/${cityId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to activate city");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "City Activated", description: `${data.city.name} is now live and operational!` });
      setReadinessCity(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "cities"] });
    },
    onError: (err: any) => {
      toast({ title: "Activation Blocked", description: err.message, variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ cityId, reason }: { cityId: number; reason: string }) => {
      const res = await fetch(`/api/cities/${cityId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to suspend city");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "City Suspended", description: `${data.city.name} operations have been suspended.` });
      setSuspendCityTarget(null);
      setSuspendReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "cities"] });
    },
    onError: (err: any) => {
      toast({ title: "Suspension Failed", description: err.message, variant: "destructive" });
    },
  });

  // KPI calculations
  const totalCount = cities.length;
  const activeCount = cities.filter((c) => c.status === "active").length;
  const setupCount = cities.filter((c) => c.status === "setup_in_progress" || c.status === "draft").length;
  const readyCount = cities.filter((c) => c.status === "ready_for_launch").length;

  const getStatusBadge = (status: CityItem["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Active Operational</Badge>;
      case "ready_for_launch":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Ready for Launch</Badge>;
      case "setup_in_progress":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Setup in Progress</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      case "archived":
        return <Badge variant="secondary">Archived</Badge>;
      case "draft":
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Multi-City Network & Expansion
              </h1>
              <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider">
                PRD v4.0 Universal
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Universal multi-city lifecycle governance, readiness audits, and independent city operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchCities()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Add Operating City
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-medium">Total Cities</CardDescription>
              <CardTitle className="text-2xl font-bold">{totalCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Across all lifecycle phases</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-medium">Active Operational</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600">{activeCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Serving live customer bookings</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-medium">Setup / Onboarding</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600">{setupCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Configuring branches & catalog</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-medium">Launch Ready</CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-600">{readyCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Checklist completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-lg border shadow-sm">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cities by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Lifecycle Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lifecycles</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="ready_for_launch">Launch Ready</SelectItem>
                <SelectItem value="setup_in_progress">Setup in Progress</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* City Cards Grid */}
        {citiesLoading ? (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Loading multi-city configuration...</p>
          </div>
        ) : cities.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <MapPin className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-lg text-foreground">No Cities Found</h3>
            <p className="text-sm mt-1 mb-4">No operating cities match the selected filter criteria.</p>
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Add New City
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cities.map((city) => (
              <Card
                key={city.id}
                className="flex flex-col justify-between hover:shadow-md transition-shadow border-t-4 border-t-primary/80"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg font-bold">{city.name}</CardTitle>
                          {city.code && (
                            <Badge variant="secondary" className="font-mono text-xs font-bold">
                              {city.code}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs mt-0.5">
                          {city.stateName} ({city.stateCode})
                        </CardDescription>
                      </div>
                      <div>{getStatusBadge(city.status)}</div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-md">
                      <div>
                        <span className="text-muted-foreground block">Timezone</span>
                        <span className="font-medium text-foreground">{city.timezone}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Currency & Locale</span>
                        <span className="font-medium text-foreground">
                          {city.currency} ({city.locale})
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Contact Phone</span>
                        <span className="font-medium text-foreground">{city.contactPhone || "Not set"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Slug / Route</span>
                        <span className="font-mono text-[11px] text-foreground">/{city.slug}</span>
                      </div>
                    </div>

                    {city.status === "suspended" && city.suspensionReason && (
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-2 rounded-md flex items-start gap-1.5">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Suspended:</strong> {city.suspensionReason}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-4 pt-0 border-t bg-card/50 mt-2 space-y-2.5">
                  {/* Quick Action Links */}
                  <div className="flex items-center justify-between text-xs pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReadinessCity(city)}
                      className="gap-1.5 text-xs h-8"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                      Readiness Audit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDashboardCity(city)}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Activity className="h-3.5 w-3.5 text-emerald-600" />
                      Operations KPI
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <Link
                      href={`/admin/branches?cityId=${city.id}`}
                      className="flex items-center justify-between p-2 rounded bg-muted/60 hover:bg-muted font-medium transition-colors"
                    >
                      <span>Branches</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                    <Link
                      href={`/admin/services?tab=city-availability`}
                      className="flex items-center justify-between p-2 rounded bg-muted/60 hover:bg-muted font-medium transition-colors"
                    >
                      <span>Service Catalog</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </div>

                  {/* Lifecycle Buttons */}
                  <div className="pt-1 flex items-center justify-end gap-2">
                    {city.status !== "active" && (
                      <Button
                        size="sm"
                        onClick={() => activateMutation.mutate({ cityId: city.id, force: true })}
                        disabled={activateMutation.isPending}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activate City
                      </Button>
                    )}
                    {city.status === "active" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setSuspendCityTarget(city)}
                        className="h-8 text-xs w-full"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Suspend City
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 1. Readiness Audit Dialog */}
        <Dialog open={!!readinessCity} onOpenChange={(open) => !open && setReadinessCity(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <DialogTitle>City Readiness Audit — {readinessCity?.name}</DialogTitle>
              </div>
              <DialogDescription>
                Authoritative 10-point checklist verifying prerequisite infrastructure, compliance, catalog, pricing,
                and staffing before public activation (PRD v4.0, CITY-003).
              </DialogDescription>
            </DialogHeader>

            {readinessLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                Evaluating operational prerequisites...
              </div>
            ) : readinessReport ? (
              <div className="space-y-4 my-2">
                {/* Score bar */}
                <div className="bg-muted p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase text-muted-foreground font-semibold">Readiness Score</span>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      <span>{readinessReport.score}%</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        ({readinessReport.passedCount} of {readinessReport.totalCount} passed)
                      </span>
                    </div>
                  </div>
                  <div>
                    {readinessReport.isReady ? (
                      <Badge className="bg-emerald-600 text-white text-xs px-3 py-1">Ready for Launch</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs px-3 py-1">
                        Critical Items Pending
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Checklist items */}
                <div className="space-y-2.5">
                  {readinessReport.checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                        item.passed
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : item.critical
                          ? "bg-destructive/5 border-destructive/20"
                          : "bg-muted/40 border-muted"
                      }`}
                    >
                      {item.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                          {item.critical && (
                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                              Mandatory
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        <div className="mt-1 text-xs font-medium text-foreground/80">{item.details}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setReadinessCity(null)}>
                Close
              </Button>
              {readinessCity?.status !== "active" && (
                <Button
                  onClick={() =>
                    activateMutation.mutate({
                      cityId: readinessCity!.id,
                      force: !readinessReport?.isReady,
                    })
                  }
                  disabled={activateMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {readinessReport?.isReady ? "Launch & Activate City" : "Force Super Admin Activation"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2. Operations KPI Dashboard Dialog */}
        <Dialog open={!!dashboardCity} onOpenChange={(open) => !open && setDashboardCity(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                <DialogTitle>{dashboardCity?.name} — Consolidated Operations</DialogTitle>
              </div>
              <DialogDescription>
                Real-time operational health, workforce capacity, and transaction metrics (CITY-004).
              </DialogDescription>
            </DialogHeader>

            {dashboardLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                Aggregating live city operational metrics...
              </div>
            ) : operationsMetrics ? (
              <div className="space-y-4 my-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> Active Branches
                    </span>
                    <p className="text-xl font-bold mt-1">
                      {operationsMetrics.activeBranchesCount} / {operationsMetrics.totalBranchesCount}
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Active Staff
                    </span>
                    <p className="text-xl font-bold mt-1">
                      {operationsMetrics.activeStaffCount + operationsMetrics.activeSupervisorsCount}
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Active Customers
                    </span>
                    <p className="text-xl font-bold mt-1">{operationsMetrics.activeCustomersCount}</p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" /> DCMS Subscriptions
                    </span>
                    <p className="text-xl font-bold mt-1">{operationsMetrics.activeDcmsSubscriptionsCount}</p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" /> Today's Jobs
                    </span>
                    <p className="text-xl font-bold mt-1">
                      {operationsMetrics.todayJobsCompleted} / {operationsMetrics.todayJobsScheduled}
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completion Rate
                    </span>
                    <p className="text-xl font-bold mt-1 text-emerald-600">
                      {operationsMetrics.todayCompletionRate}%
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg border flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase text-muted-foreground font-semibold">Month-to-Date Collections</span>
                    <p className="text-2xl font-bold text-foreground">
                      ₹{operationsMetrics.monthlyCollections.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Current Billing Cycle
                  </Badge>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button onClick={() => setDashboardCity(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 3. Add City Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Establish New Operating City</DialogTitle>
              <DialogDescription>
                Initializes a new city in setup status with independent configuration, catalog, and governance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">City Name *</label>
                <Input
                  placeholder="e.g. Ghaziabad, Gurugram, Lucknow"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">State Link *</label>
                  <Select value={newStateId} onValueChange={setNewStateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">3-Letter Code</label>
                  <Input
                    placeholder="e.g. GZB, GGN"
                    maxLength={4}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Customer Support Phone</label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Operational Contact Email</label>
                <Input
                  placeholder="e.g. city.operations@cwpdetailers.com"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || !newStateId || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create City"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 4. Suspend City Dialog */}
        <Dialog open={!!suspendCityTarget} onOpenChange={(open) => !open && setSuspendCityTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle>Suspend Operating City</DialogTitle>
              </div>
              <DialogDescription>
                Suspending <strong>{suspendCityTarget?.name}</strong> will prevent new customer bookings and invalidate
                active operational sessions for city-scoped personnel.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 my-2">
              <label className="text-xs font-semibold text-foreground">Reason for Suspension *</label>
              <Input
                placeholder="e.g. Scheduled monsoon maintenance, restructuring, regulatory update"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendCityTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  suspendMutation.mutate({
                    cityId: suspendCityTarget!.id,
                    reason: suspendReason,
                  })
                }
                disabled={!suspendReason.trim() || suspendMutation.isPending}
              >
                {suspendMutation.isPending ? "Suspending..." : "Confirm City Suspension"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
