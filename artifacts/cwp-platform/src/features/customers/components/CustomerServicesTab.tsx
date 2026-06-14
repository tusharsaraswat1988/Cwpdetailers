import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Sparkles,
  Package,
  Sun,
  Car,
  Calendar,
  Plus,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { fetchCustomerServicesHub } from "../api";
import { Can } from "@/components/Can";
import {
  AddCustomerServiceWizard,
  type CustomerServiceProduct,
} from "./AddCustomerServiceWizard";
import { CustomerPersonaSummary } from "./CustomerPersonaBadges";
import {
  SERVICE_PRODUCTS,
  formatProductLineLabel,
  type ServiceProductId,
} from "@workspace/customer-model";
import { serviceProductIcon } from "./serviceProductIcons";

type Props = {
  customerId: number;
  basePath: string;
};

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "active" || s === "completed") return "text-green-600 border-green-600/30";
  if (s === "paused" || s === "pending") return "text-amber-600 border-amber-600/30";
  if (s === "expired" || s === "cancelled" || s === "rejected") return "text-red-500 border-red-500/30";
  return "";
}

function formatTypeLabel(type: string) {
  return formatProductLineLabel(type);
}

const QUICK_ACTIONS: ServiceProductId[] = [
  "daily_cleaning",
  "wash_package",
  "one_time_wash",
  "one_time_solar",
  "solar_amc",
];

function formatBundledAddonNames(
  addons?: string[] | Array<{ name?: string }> | null,
): string | null {
  if (!addons?.length) return null;
  return addons
    .map(a => (typeof a === "string" ? a : a.name))
    .filter(Boolean)
    .join(", ");
}

export function CustomerServicesTab({ customerId, basePath }: Props) {
  const isAdmin = basePath.startsWith("/admin");
  const bookingsPath = isAdmin ? "/admin/bookings" : "/franchisee/bookings";
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardProduct, setWizardProduct] = useState<CustomerServiceProduct | undefined>();

  const { data: hub, isLoading, refetch } = useQuery({
    queryKey: ["customer", customerId, "services-hub"],
    queryFn: () => fetchCustomerServicesHub(customerId),
    enabled: customerId > 0,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add") {
      setWizardOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const openWizard = (product?: CustomerServiceProduct) => {
    setWizardProduct(product);
    setWizardOpen(true);
  };

  const handleWizardOpenChange = (open: boolean) => {
    setWizardOpen(open);
    if (!open) setWizardProduct(undefined);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const counts = hub?.counts ?? {
    dailyCleaning: 0,
    entitlements: 0,
    legacySubscriptions: 0,
    solarSites: 0,
    activeContracts: 0,
  };

  const availableProducts = hub?.profile?.availableServiceProducts ?? QUICK_ACTIONS;
  const quickActions = QUICK_ACTIONS.filter(id => availableProducts.includes(id));

  const kpiItems = [
    { label: "Active plans", value: counts.activeContracts, icon: ClipboardList },
    { label: "Daily cleaning", value: counts.dailyCleaning, icon: Sparkles },
    { label: "Packages", value: counts.entitlements, icon: Package },
    { label: "Contracts", value: counts.legacySubscriptions, icon: Car },
    { label: "Solar sites", value: counts.solarSites, icon: Sun },
  ];

  return (
    <div className="space-y-4" data-testid="customer-services-tab">
      {hub?.profile && <CustomerPersonaSummary profile={hub.profile} />}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {kpiItems.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <k.icon size={14} className="text-primary" />{k.label}
              </div>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Add & manage</CardTitle>
          <Can resource="customers" action="edit">
            <Button
              size="sm"
              className="bg-primary text-secondary shrink-0"
              onClick={() => openWizard()}
              data-testid="btn-add-service"
            >
              <Plus size={14} className="mr-1.5" />Add service
            </Button>
          </Can>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Can resource="customers" action="edit">
            {quickActions.map(id => {
              const def = SERVICE_PRODUCTS[id];
              const Icon = serviceProductIcon(def.icon);
              return (
                <Button
                  key={id}
                  size="sm"
                  variant="outline"
                  onClick={() => openWizard(id)}
                  data-testid={id === "daily_cleaning" ? "btn-add-dcms-plan" : id === "wash_package" ? "btn-grant-package" : undefined}
                >
                  <Icon size={14} className="mr-1.5" />{def.label}
                </Button>
              );
            })}
          </Can>
          <Link href={`${bookingsPath}?customerId=${customerId}`}>
            <Button size="sm" variant="outline" data-testid="btn-book-service">
              <Calendar size={14} className="mr-1.5" />All bookings
            </Button>
          </Link>
          {isAdmin && (
            <Link href="/admin/daily-cleaning/subscriptions">
              <Button size="sm" variant="ghost" className="text-muted-foreground">
                <ExternalLink size={14} className="mr-1.5" />DCMS admin
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />Contract registry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(hub?.contracts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No contracts registered yet.</p>
          ) : (
            hub!.contracts.map(c => {
              const bundledLabel = formatBundledAddonNames(
                c.summary.bundledAddons as string[] | Array<{ name?: string }> | undefined,
              );
              return (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border rounded-lg px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium capitalize">{formatTypeLabel(c.productLine)}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.assetLabel ?? "Customer-level"}
                    {" · "}{c.sourceSystem} #{c.sourceId}
                    {c.validUntil ? ` · until ${new Date(c.validUntil).toLocaleDateString("en-IN")}` : ""}
                  </p>
                  {bundledLabel && (
                    <p className="text-xs text-muted-foreground">Includes: {bundledLabel}</p>
                  )}
                </div>
                <Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(c.status)}`}>{c.status}</Badge>
              </div>
            );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />Daily car cleaning (DCMS)
          </CardTitle>
          {(hub?.dailyCleaning ?? []).length === 0 && (
            <Can resource="customers" action="edit">
              <Button size="sm" variant="ghost" onClick={() => openWizard("daily_cleaning")}>
                <Plus size={14} className="mr-1" />Add plan
              </Button>
            </Can>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(hub?.dailyCleaning ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No daily cleaning plans yet.</p>
          ) : (
            hub!.dailyCleaning.map(row => (
              <div key={row.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border rounded-lg px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{row.vehicleLabel}</p>
                  <p className="text-xs text-muted-foreground">{row.planName} · started {new Date(row.startDate).toLocaleDateString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {row.remainingCleanings}/{row.allocatedCleanings} cleanings · {row.remainingWashes}/{row.allocatedWashes} washes
                    {row.assignedStaffName ? ` · ${row.assignedStaffName}` : ""}
                  </p>
                  {row.bundledAddons.length > 0 && (
                    <p className="text-xs text-muted-foreground">Includes: {row.bundledAddons.join(", ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {row.renewalEligible && <Badge variant="outline" className="text-xs text-amber-600 border-amber-600/30">Renewal due</Badge>}
                  <Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(row.status)}`}>{row.status}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package size={16} className="text-primary" />Wash packages & credits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(hub?.entitlements ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active package entitlements.</p>
          ) : (
            hub!.entitlements.map(e => (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border rounded-lg px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{e.packageName ?? e.serviceName ?? formatTypeLabel(e.entitlementType)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{formatTypeLabel(e.entitlementType)}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.remainingCredits}/{e.totalCredits} credits · valid until {new Date(e.validUntil).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(e.status)}`}>{e.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Car size={16} className="text-primary" />Service contracts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(hub?.legacySubscriptions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No monthly wash, solar AMC, or detailing contracts.</p>
          ) : (
            hub!.legacySubscriptions.map(s => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border rounded-lg px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium capitalize">{formatTypeLabel(s.type)}</p>
                  {s.serviceName && <p className="text-xs text-muted-foreground">{s.serviceName}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.startDate).toLocaleDateString("en-IN")} – {new Date(s.endDate).toLocaleDateString("en-IN")}
                    {s.servicesRemaining != null ? ` · ${s.servicesRemaining}/${s.totalServices ?? "—"} remaining` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(s.status)}`}>{s.status}</Badge>
              </div>
            ))
          )}
          {isAdmin && (hub?.legacySubscriptions ?? []).length > 0 && (
            <Link href="/admin/subscriptions" className="text-xs text-primary hover:underline inline-block mt-1">
              Manage all subscriptions →
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun size={16} className="text-primary" />Solar sites
          </CardTitle>
          {(hub?.solarSites ?? []).length === 0 && (
            <Can resource="customers" action="edit">
              <Button size="sm" variant="ghost" onClick={() => openWizard("one_time_solar")}>
                <Plus size={14} className="mr-1" />Add site
              </Button>
            </Can>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(hub?.solarSites ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No solar sites registered.</p>
          ) : (
            hub!.solarSites.map(site => (
              <div key={site.id} className="border border-border rounded-lg px-3 py-2.5 text-sm">
                <p className="font-medium">{site.address}</p>
                <p className="text-xs text-muted-foreground">
                  {site.panelCount} panels · {site.completedBookings} completed cleanings
                  {site.activeAmcEntitlements > 0 ? ` · ${site.activeAmcEntitlements} AMC` : ""}
                </p>
                {site.nextServiceDate && (
                  <p className="text-xs text-muted-foreground">Next service: {new Date(site.nextServiceDate).toLocaleDateString("en-IN")}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={16} className="text-primary" />Recent work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(hub?.recentWork ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent visits or bookings.</p>
          ) : (
            hub!.recentWork.map(w => (
              <div key={w.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm">
                <div>
                  <p className="font-medium capitalize">{formatTypeLabel(w.workType)}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.assetLabel ?? "—"}
                    {w.staffName ? ` · ${w.staffName}` : ""}
                    {" · "}{new Date(w.occurredAt).toLocaleDateString("en-IN")}
                  </p>
                  {w.addonLabel && (
                    <p className="text-xs text-muted-foreground">Add-ons: {w.addonLabel}</p>
                  )}
                </div>
                <Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(w.status)}`}>{w.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AddCustomerServiceWizard
        open={wizardOpen}
        onOpenChange={handleWizardOpenChange}
        customerId={customerId}
        basePath={basePath}
        initialProduct={wizardProduct}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
