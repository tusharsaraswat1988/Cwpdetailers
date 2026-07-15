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

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <PageActionHeader
          title={isHomepage ? "Homepage CMS" : "Service Catalog"}
          description={
            isHomepage
              ? "Website marketing content — hero, testimonials, and public homepage sections. Most branches rarely need this."
              : `What ${branding.brandName} sells — three revenue lines. Prices are set by HQ; branches choose what to offer when booking.`
          }
          primaryAction={{
            label: isHomepage ? "Back to catalog" : "Add car wash service",
            href: isHomepage ? "/admin/services?tab=wash-services" : "/admin/services?tab=wash-services",
            testId: "catalog-primary-cta",
          }}
        />

        {isHomepage ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-sm text-muted-foreground">
              This is a <strong className="text-foreground">marketing tool</strong>, not part of daily operations.
              Edit homepage content only when updating your public website.
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} className="space-y-5">
            <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
                Services Type
              </p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => goTab(carWashSub === "packages" ? "wash-packages" : "wash-services")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 rounded-md",
                    isCarWashTab(tab) ? "bg-primary text-secondary font-medium" : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  <Wrench size={14} /> Car Wash
                </button>
                <button
                  type="button"
                  onClick={() => goTab("daily-cleaning")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 rounded-md",
                    tab === "daily-cleaning" ? "bg-primary text-secondary font-medium" : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  <Sparkles size={14} /> Daily Cleaning
                </button>
                <button
                  type="button"
                  onClick={() => goTab("solar")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 rounded-md",
                    tab === "solar" ? "bg-primary text-secondary font-medium" : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  <Sun size={14} /> Solar Cleaning
                </button>
                <button
                  type="button"
                  onClick={() => goTab("addons")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 rounded-md",
                    tab === "addons" ? "bg-primary text-secondary font-medium" : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  <Layers size={14} /> Add-ons
                </button>
                <button
                  type="button"
                  onClick={() => goTab("advanced")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 rounded-md",
                    tab === "advanced" ? "bg-primary text-secondary font-medium" : "bg-muted/60 text-muted-foreground",
                  )}
                >
                  Advanced (GST)
                </button>
              </div>
              {isCarWashTab(tab) && (
                <div className="flex gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => goTab("wash-services")}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-md",
                      carWashSub === "services" ? "bg-primary text-secondary font-medium" : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    One Time Services
                  </button>
                  <button
                    type="button"
                    onClick={() => goTab("wash-packages")}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-md",
                      carWashSub === "packages" ? "bg-primary text-secondary font-medium" : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    Packages
                  </button>
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

            <TabsContent value="advanced">
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
            </TabsContent>
          </Tabs>
        )}

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
