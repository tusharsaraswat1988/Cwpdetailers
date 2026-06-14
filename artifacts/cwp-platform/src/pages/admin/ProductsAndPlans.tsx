import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useHomepageSections, useCatalogSettings, useSaveCatalogSettings,
} from "@/features/service-catalog/api";
import { CategoriesTab } from "@/features/service-catalog/components/CategoriesTab";
import { ServicesTab } from "@/features/service-catalog/components/ServicesTab";
import { PricingTab } from "@/features/service-catalog/components/PricingTab";
import { SolarSlabsTab } from "@/features/service-catalog/components/SolarSlabsTab";
import { PackagesTab } from "@/features/products/components/PackagesTab";
import { DcmsPlansPanel } from "@/features/products/components/DcmsPlansPanel";
import { useToast } from "@/hooks/use-toast";
import {
  Layers, Wrench, MapPin, Sun, Package, Home, Settings, Sparkles, CreditCard,
} from "lucide-react";

const TAB_VALUES = [
  "services", "packages", "dcms-plans", "pricing", "solar", "categories", "homepage", "settings",
] as const;

type TabValue = typeof TAB_VALUES[number];

function tabFromSearch(search: string): TabValue {
  const tab = new URLSearchParams(search).get("tab");
  return TAB_VALUES.includes(tab as TabValue) ? (tab as TabValue) : "services";
}

export default function ProductsAndPlansPage() {
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

  const onTabChange = (value: string) => {
    const next = value as TabValue;
    setTab(next);
    setLocation(`/admin/services?tab=${next}`);
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <Sparkles className="text-primary" size={24} /> Services
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Catalog setup — one-time services, packages, daily cleaning plans, pricing, and homepage visibility
            </p>
          </div>
          <Badge variant="outline" className="w-fit">Unified catalog</Badge>
        </div>

        <Tabs value={tab} onValueChange={onTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {[
              { v: "services", l: "Services", i: Wrench },
              { v: "packages", l: "Packages", i: Package },
              { v: "dcms-plans", l: "DCMS Plans", i: CreditCard },
              { v: "pricing", l: "City Pricing", i: MapPin },
              { v: "solar", l: "Solar Slabs", i: Sun },
              { v: "categories", l: "Categories", i: Layers },
              { v: "homepage", l: "Homepage CMS", i: Home },
              { v: "settings", l: "GST", i: Settings },
            ].map(({ v, l, i: Icon }) => (
              <TabsTrigger key={v} value={v} className="gap-1.5 text-xs sm:text-sm">
                <Icon size={14} /> {l}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="services">
            <p className="text-xs text-muted-foreground mb-3">
              Create one-time services here. Add-ons are configured inside each service&apos;s edit dialog.
            </p>
            <ServicesTab />
          </TabsContent>

          <TabsContent value="packages"><PackagesTab /></TabsContent>

          <TabsContent value="dcms-plans"><DcmsPlansPanel embedded /></TabsContent>

          <TabsContent value="pricing"><PricingTab /></TabsContent>
          <TabsContent value="solar"><SolarSlabsTab /></TabsContent>
          <TabsContent value="categories"><CategoriesTab /></TabsContent>

          <TabsContent value="homepage">
            <div className="grid gap-4">
              {(homepage ?? []).map(section => (
                <Card key={section.sectionKey}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base capitalize">{section.sectionKey.replace(/-/g, " ")}</CardTitle>
                    <CardDescription>{section.title}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(section.content, null, 2)}</pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">GST & catalog defaults</CardTitle>
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
      </div>
    </AdminLayout>
  );
}
