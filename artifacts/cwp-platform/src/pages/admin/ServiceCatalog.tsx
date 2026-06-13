import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCatalogPackages, useHomepageSections, useCatalogSettings, useSaveCatalogSettings,
} from "@/features/service-catalog/api";
import { CategoriesTab } from "@/features/service-catalog/components/CategoriesTab";
import { ServicesTab } from "@/features/service-catalog/components/ServicesTab";
import { PricingTab } from "@/features/service-catalog/components/PricingTab";
import { SolarSlabsTab } from "@/features/service-catalog/components/SolarSlabsTab";
import { useToast } from "@/hooks/use-toast";
import {
  Layers, Wrench, MapPin, Sun, Package, Home, Settings, Sparkles,
} from "lucide-react";

export default function ServiceCatalog() {
  const { toast } = useToast();
  const [tab, setTab] = useState("categories");
  const { data: packages } = useCatalogPackages();
  const { data: homepage } = useHomepageSections();
  const { data: settings } = useCatalogSettings();
  const saveSettings = useSaveCatalogSettings();

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <Sparkles className="text-primary" size={24} /> Service Catalog Engine
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Services · Pricing · Packages · Addons · CMS</p>
          </div>
          <Badge variant="outline" className="w-fit">Multi-city ready</Badge>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {[
              { v: "categories", l: "Categories", i: Layers },
              { v: "services", l: "Services", i: Wrench },
              { v: "pricing", l: "City Pricing", i: MapPin },
              { v: "solar", l: "Solar Slabs", i: Sun },
              { v: "packages", l: "Packages", i: Package },
              { v: "homepage", l: "Homepage", i: Home },
              { v: "settings", l: "GST", i: Settings },
            ].map(({ v, l, i: Icon }) => (
              <TabsTrigger key={v} value={v} className="gap-1.5 text-xs sm:text-sm">
                <Icon size={14} /> {l}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="categories"><CategoriesTab /></TabsContent>

          <TabsContent value="services"><ServicesTab /></TabsContent>

          <TabsContent value="pricing"><PricingTab /></TabsContent>
          <TabsContent value="solar"><SolarSlabsTab /></TabsContent>

          <TabsContent value="packages">
            <div className="grid gap-4 md:grid-cols-2">
              {(packages ?? []).map(pkg => (
                <Card key={pkg.id} className={pkg.isHighlighted ? "ring-2 ring-primary/30" : ""}>
                  <CardHeader>
                    <div className="flex justify-between">
                      <CardTitle className="text-base">{pkg.name}</CardTitle>
                      {pkg.tag && <Badge>{pkg.tag}</Badge>}
                    </div>
                    <CardDescription>{pkg.validityDays} days · ₹{pkg.price}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(pkg.entitlements ?? []).map(e => (
                      <Badge key={e.id} variant="outline" className="mr-1 mb-1 text-xs">
                        {e.creditCount}× {e.entitlementType.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

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
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>GST Engine</CardTitle>
                <CardDescription>Global default — services can override</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Default GST Mode</Label>
                  <Select
                    defaultValue={String(settings?.default_gst_mode ?? "inclusive").replace(/"/g, "")}
                    onValueChange={v => saveSettings.mutate({ default_gst_mode: v }, { onSuccess: () => toast({ title: "Saved" }) })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">GST Inclusive</SelectItem>
                      <SelectItem value="exclusive">GST Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default GST Rate (%)</Label>
                  <Input type="number" defaultValue={String(settings?.default_gst_rate ?? 18)} className="mt-1"
                    onBlur={e => saveSettings.mutate({ default_gst_rate: parseFloat(e.target.value) }, { onSuccess: () => toast({ title: "Saved" }) })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
