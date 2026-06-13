import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListServices, getListServicesQueryKey } from "@workspace/api-client-react";
import {
  useCatalogPackages, useCatalogAddons, useSolarSlabs, useHomepageSections,
  useCatalogSettings, useCityAvailability, useCatalogMutations, useSaveHomepageSection, useSaveCatalogSettings,
} from "@/features/service-catalog/api";
import { useServiceCategories, useCities, useMasterMutations } from "@/features/master-data/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Layers, Wrench, MapPin, Sun, Plus, Package, Home, Settings, Sparkles, IndianRupee,
} from "lucide-react";

export default function ServiceCatalog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("categories");

  const { data: categories } = useServiceCategories();
  const { data: services } = useListServices({}, { query: { queryKey: getListServicesQueryKey({}) } });
  const { data: packages } = useCatalogPackages();
  const { data: addons } = useCatalogAddons();
  const { data: slabs } = useSolarSlabs();
  const { data: homepage } = useHomepageSections();
  const { data: settings } = useCatalogSettings();
  const { data: cities } = useCities();
  const catMutations = useMasterMutations("service-categories");
  const packageMutations = useCatalogMutations("packages");
  const addonMutations = useCatalogMutations("addons");
  const slabMutations = useCatalogMutations("solar-slabs");
  const saveHomepage = useSaveHomepageSection();
  const saveSettings = useSaveCatalogSettings();

  const solarService = services?.find(s => s.category === "solar_cleaning");

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <Sparkles className="text-primary" size={24} /> Service Catalog Engine
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Single source of truth — services, pricing, packages, addons & CMS
            </p>
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
              { v: "addons", l: "Addons", i: Plus },
              { v: "packages", l: "Packages", i: Package },
              { v: "homepage", l: "Homepage", i: Home },
              { v: "settings", l: "GST & Settings", i: Settings },
            ].map(({ v, l, i: Icon }) => (
              <TabsTrigger key={v} value={v} className="gap-1.5 text-xs sm:text-sm">
                <Icon size={14} /> {l}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Service Categories</CardTitle>
                <CardDescription>Admin-managed, sortable categories with display controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(categories ?? []).map(cat => (
                  <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <label className="flex items-center gap-1">
                        <Switch checked={cat.isActive} onCheckedChange={v => catMutations.update.mutate({ id: cat.id, isActive: v })} />
                        Active
                      </label>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <div className="grid gap-3 md:grid-cols-2">
              {(services ?? []).map(svc => (
                <Card key={svc.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{svc.name}</CardTitle>
                      <Badge variant={svc.isActive ? "default" : "secondary"}>{svc.category?.replace(/_/g, " ")}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{svc.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-between text-sm">
                    <span className="flex items-center gap-1"><IndianRupee size={14} />{svc.basePrice}</span>
                    <span className="text-muted-foreground">{svc.durationMinutes ?? "—"} min</span>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Full service CMS editing available via API. Use basic Services page for quick create.
            </p>
          </TabsContent>

          {/* City Pricing Tab */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>City-Specific Pricing</CardTitle>
                <CardDescription>Same service, different city pricing — never hardcoded</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {(cities ?? []).slice(0, 10).map(city => (
                    <div key={city.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium">{city.name}</span>
                      <Badge variant="outline">{city.slug}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Configure per-service city overrides via City Availability API. Varanasi pricing migrated from existing matrix.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Solar Slabs Tab */}
          <TabsContent value="solar">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Solar Pricing Slabs</CardTitle>
                  <CardDescription>Per-panel pricing with minimum billing — admin configurable</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(slabs ?? []).map(slab => (
                  <div key={slab.id} className="p-3 border rounded-lg flex flex-wrap gap-4 items-center">
                    <span>{slab.minPanels}–{slab.maxPanels ?? "∞"} panels</span>
                    <span>₹{slab.pricePerPanel}/panel</span>
                    <span>Min ₹{slab.minimumBilling}</span>
                    <Badge variant="outline">Service #{slab.serviceId}</Badge>
                  </div>
                ))}
                {!(slabs ?? []).length && (
                  <p className="text-sm text-muted-foreground">No slabs configured. Run catalog migration seed.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addons Tab */}
          <TabsContent value="addons">
            <div className="grid gap-3 sm:grid-cols-2">
              {(addons ?? []).map(addon => (
                <Card key={addon.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{addon.name}</CardTitle>
                    <CardDescription>{addon.description ?? addon.slug}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-between">
                    <span className="font-semibold">₹{addon.basePrice}</span>
                    <Badge variant={addon.isActive ? "default" : "secondary"}>{addon.isActive ? "Active" : "Disabled"}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Packages Tab */}
          <TabsContent value="packages">
            <div className="grid gap-4 md:grid-cols-2">
              {(packages ?? []).map(pkg => (
                <Card key={pkg.id} className={pkg.isHighlighted ? "ring-2 ring-primary/30" : ""}>
                  <CardHeader>
                    <div className="flex justify-between">
                      <CardTitle className="text-base">{pkg.name}</CardTitle>
                      {pkg.tag && <Badge>{pkg.tag}</Badge>}
                    </div>
                    <CardDescription>{pkg.validityDays} days validity</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xl font-bold">₹{pkg.price}</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {(pkg.features ?? []).map((f, i) => <li key={i}>• {f}</li>)}
                    </ul>
                    {(pkg.entitlements ?? []).length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium mb-1">Entitlements:</p>
                        {pkg.entitlements!.map(e => (
                          <Badge key={e.id} variant="outline" className="mr-1 mb-1 text-xs">
                            {e.creditCount}× {e.entitlementType.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Homepage CMS Tab */}
          <TabsContent value="homepage">
            <div className="grid gap-4">
              {(homepage ?? []).map(section => (
                <Card key={section.sectionKey}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base capitalize">{section.sectionKey.replace(/-/g, " ")}</CardTitle>
                    <CardDescription>{section.title}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(section.content, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}
              {!(homepage ?? []).length && (
                <p className="text-sm text-muted-foreground">Run catalog migration to seed homepage sections.</p>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>GST Engine & Global Settings</CardTitle>
                <CardDescription>Default GST mode applies unless overridden at service level</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div>
                  <Label>Default GST Mode</Label>
                  <Select
                    defaultValue={String(settings?.default_gst_mode ?? "inclusive").replace(/"/g, "")}
                    onValueChange={v => saveSettings.mutate({ default_gst_mode: v }, {
                      onSuccess: () => toast({ title: "Settings saved" }),
                    })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">GST Inclusive (customer-friendly)</SelectItem>
                      <SelectItem value="exclusive">GST Exclusive (invoice breakup)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default GST Rate (%)</Label>
                  <Input
                    type="number"
                    defaultValue={String(settings?.default_gst_rate ?? 18)}
                    className="mt-1"
                    onBlur={e => saveSettings.mutate({ default_gst_rate: parseFloat(e.target.value) }, {
                      onSuccess: () => toast({ title: "GST rate updated" }),
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
