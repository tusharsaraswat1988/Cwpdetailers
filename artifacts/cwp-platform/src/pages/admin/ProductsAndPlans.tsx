import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { useBranding } from "@/lib/branding";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useHomepageSections, useCatalogSettings, useSaveCatalogSettings,
} from "@/features/service-catalog/api";
import { ServicesTab } from "@/features/service-catalog/components/ServicesTab";
import { AddonsTab } from "@/features/service-catalog/components/AddonsTab";
import { PackagesTab } from "@/features/products/components/PackagesTab";
import { SolarCatalogPanel } from "@/features/service-catalog/components/SolarCatalogPanel";
import { DcmsPlansPanel } from "@/features/products/components/DcmsPlansPanel";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Sun, Home, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_VALUES = [
  "wash-services", "wash-packages", "daily-cleaning", "solar", "addons", "homepage", "advanced",
] as const;

type TabValue = typeof TAB_VALUES[number];

const LEGACY_TAB_MAP: Record<string, TabValue> = {
  services: "wash-services",
  packages: "wash-packages",
  "dcms-plans": "daily-cleaning",
  pricing: "wash-services",
  solar: "solar",
  categories: "wash-services",
  settings: "advanced",
};

function tabFromSearch(search: string): TabValue {
  const raw = new URLSearchParams(search).get("tab");
  if (!raw) return "wash-services";
  if (TAB_VALUES.includes(raw as TabValue)) return raw as TabValue;
  return LEGACY_TAB_MAP[raw] ?? "wash-services";
}

function isCarWashTab(tab: TabValue) {
  return tab === "wash-services" || tab === "wash-packages";
}

export default function ProductsAndPlansPage() {
  const branding = useBranding();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const [tab, setTab] = useState<TabValue>(() => tabFromSearch(search));

  const { data: homepage } = useHomepageSections();
  const { data: settings } = useCatalogSettings();
  const saveSettings = useSaveCatalogSettings();

  useEffect(() => {
    setTab(tabFromSearch(search));
  }, [search]);

  const goTab = (next: TabValue) => {
    setTab(next);
    setLocation(`/admin/services?tab=${next}`);
  };

  const carWashSub: "services" | "packages" = tab === "wash-packages" ? "packages" : "services";

  const isHomepage = tab === "homepage";
  const isAdvanced = tab === "advanced";
  const isSetupView = isHomepage || isAdvanced;

  const pageTitle = isHomepage
    ? "Homepage CMS"
    : isAdvanced
      ? "Catalog GST Defaults"
      : "Service Catalog";
  const pageDescription = isHomepage
    ? "Website marketing content — hero, testimonials, and public homepage sections. Most branches rarely need this."
    : isAdvanced
      ? "Default tax settings applied when HQ creates new catalog items. Separate from company Invoice & GST identity."
      : `What ${branding.brandName} sells — three revenue lines. Prices are set by HQ; branches choose what to offer when booking.`;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <PageActionHeader
          title={pageTitle}
          description={pageDescription}
          primaryAction={isSetupView ? {
            label: "Back to catalog",
            href: "/admin/services?tab=wash-services",
            testId: "catalog-primary-cta",
          } : undefined}
        />

        {isHomepage ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-sm text-muted-foreground">
              This is a <strong className="text-foreground">marketing tool</strong>, not part of daily operations.
              Edit homepage content only when updating your public website.
            </CardContent>
          </Card>
        ) : null}

        {isAdvanced ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">GST defaults</CardTitle>
              <CardDescription>Default tax settings applied to new catalog items (HQ).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div>
                <Label>Default GST mode</Label>
                <Select
                  value={String((settings as { defaultPricingType?: string })?.defaultPricingType ?? "inclusive")}
                  onValueChange={v => saveSettings.mutate({ defaultPricingType: v }, {
                    onSuccess: () => toast({ title: "Settings saved" }),
                    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
                  })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inclusive">Inclusive</SelectItem>
                    <SelectItem value="exclusive">Exclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default GST rate (%)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  defaultValue={String((settings as { defaultGstRate?: number })?.defaultGstRate ?? 18)}
                  onBlur={e => saveSettings.mutate({ defaultGstRate: parseFloat(e.target.value) }, {
                    onSuccess: () => toast({ title: "Settings saved" }),
                  })}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isSetupView ? (
          <Tabs value={tab} className="space-y-4">
            <div
              className="rounded-xl border border-border bg-card/50 p-3 sm:p-4 space-y-3"
              role="tablist"
              aria-label="Revenue line"
            >
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { target: "wash-services" as TabValue, active: isCarWashTab(tab), icon: Wrench, label: "Car Wash" },
                    { target: "daily-cleaning" as TabValue, active: tab === "daily-cleaning", icon: Sparkles, label: "Daily Cleaning" },
                    { target: "solar" as TabValue, active: tab === "solar", icon: Sun, label: "Solar Cleaning" },
                    { target: "addons" as TabValue, active: tab === "addons", icon: Layers, label: "Add-ons" },
                  ]
                ).map(({ target, active, icon: Icon, label }) => (
                  <button
                    key={target}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => goTab(target === "wash-services" && carWashSub === "packages" ? "wash-packages" : target)}
                    className={cn(
                      "inline-flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-lg min-h-10 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      active
                        ? "bg-primary text-secondary font-semibold shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon size={15} className="shrink-0" /> {label}
                  </button>
                ))}
              </div>

              {isCarWashTab(tab) && (
                <div className="flex items-center gap-2 pl-1 pt-1 border-t border-border/60 -mx-3 sm:-mx-4 px-3 sm:px-4 pb-0">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 mr-1 shrink-0">
                    Car Wash:
                  </span>
                  <div
                    className="inline-flex rounded-md bg-muted/60 p-0.5 gap-0.5"
                    role="tablist"
                    aria-label="Car wash view"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={carWashSub === "services"}
                      onClick={() => goTab("wash-services")}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-[5px] font-medium min-h-8 transition-colors",
                        carWashSub === "services" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      One Time Services
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={carWashSub === "packages"}
                      onClick={() => goTab("wash-packages")}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-[5px] font-medium min-h-8 transition-colors",
                        carWashSub === "packages" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Packages
                    </button>
                  </div>
                </div>
              )}
            </div>

            <TabsContent value="wash-services">
              <p className="text-xs text-muted-foreground mb-3">
                One-time car wash and detailing — Foam Wash, Interior, Exterior, Detailing, and more.
              </p>
              <ServicesTab revenueLine="car_wash" />
            </TabsContent>

            <TabsContent value="wash-packages">
              <p className="text-xs text-muted-foreground mb-3">
                Prepaid wash packages — 4-wash, 8-wash, 12-wash deals sold to customers.
              </p>
              <PackagesTab packageFilter="wash" />
            </TabsContent>

            <TabsContent value="daily-cleaning">
              <p className="text-xs text-muted-foreground mb-3">
                Monthly daily cleaning plans — price per month, cleans, washes, and weekly offs.
              </p>
              <DcmsPlansPanel embedded />
            </TabsContent>

            <TabsContent value="solar">
              <p className="text-xs text-muted-foreground mb-3">
                Solar cleaning products — one-time cleaning, 6-month plan, and 12-month plan.
              </p>
              <SolarCatalogPanel />
            </TabsContent>

            <TabsContent value="addons">
              <p className="text-xs text-muted-foreground mb-3">
                Create shared add-ons and link them to one-time services. Bundle the same catalog into wash packages and daily cleaning plans.
              </p>
              <AddonsTab />
            </TabsContent>
          </Tabs>
        ) : null}

        {isHomepage && (
          <div className="grid gap-4">
            {(homepage ?? []).map(section => (
              <Card key={section.sectionKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base capitalize flex items-center gap-2">
                    <Home size={16} className="text-primary" />
                    {section.sectionKey.replace(/-/g, " ")}
                  </CardTitle>
                  <CardDescription>{section.title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(section.content, null, 2)}</pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
