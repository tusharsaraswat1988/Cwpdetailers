import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Car, Sun, Plus, Search, Layers } from "lucide-react";
import { listAssets, createAsset, ASSET_TYPE_LABELS, type AssetType } from "@/features/assets/api";
import { listServiceLocations } from "@/features/service-locations/api";
import {
  VehicleForm,
  SolarSiteForm,
  EMPTY_VEHICLE_ASSET_FORM,
  EMPTY_SOLAR_ASSET_FORM,
} from "@/features/assets/components/AssetForms";
import type { VehicleModel } from "@/features/master-data/api";

export default function AssetsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();
  const customerIdParam = new URLSearchParams(location.includes("?") ? location.slice(location.indexOf("?")) : "").get("customerId");
  const filterCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : undefined;
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<"vehicle" | "solar_site">("vehicle");
  const [vehicleForm, setVehicleForm] = useState({
    ...EMPTY_VEHICLE_ASSET_FORM,
    customerId: filterCustomerId ? String(filterCustomerId) : "",
  });
  const [solarForm, setSolarForm] = useState({
    ...EMPTY_SOLAR_ASSET_FORM,
    customerId: filterCustomerId ? String(filterCustomerId) : "",
  });
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["assets", typeFilter, filterCustomerId],
    queryFn: () => listAssets({
      customerId: filterCustomerId,
      assetType: typeFilter === "all" ? undefined : typeFilter,
      limit: 100,
    }),
  });

  const serviceLocationCustomerId = filterCustomerId
    ?? (vehicleForm.customerId ? parseInt(vehicleForm.customerId, 10) : undefined)
    ?? (solarForm.customerId ? parseInt(solarForm.customerId, 10) : undefined);

  const { data: locationsData } = useQuery({
    queryKey: ["service-locations", "asset-create", serviceLocationCustomerId],
    queryFn: () => listServiceLocations({ customerId: serviceLocationCustomerId!, limit: 50 }),
    enabled: Boolean(serviceLocationCustomerId),
  });

  const serviceLocations = (locationsData?.data ?? []).map((l: { id: number; label: string }) => ({
    id: l.id,
    label: l.label,
  }));

  const rows = (data?.data ?? []).filter(r =>
    !search || r.label.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      if (createTab === "vehicle") {
        if (!vehicleForm.customerId || !vehicleForm.serviceLocationId || !vehicleForm.registrationNumber.trim() || !selectedModel) {
          toast({ title: "Customer, location, model, and vehicle number are required", variant: "destructive" });
          return;
        }
        const result = await createAsset({
          assetType: "vehicle",
          customerId: parseInt(vehicleForm.customerId, 10),
          serviceLocationId: parseInt(vehicleForm.serviceLocationId, 10),
          registrationNumber: vehicleForm.registrationNumber.trim(),
          vehicleModelId: selectedModel.id,
          vehicleType: vehicleForm.vehicleType,
          year: vehicleForm.year ? parseInt(vehicleForm.year, 10) : undefined,
          color: vehicleForm.color || undefined,
          notes: vehicleForm.notes || undefined,
        });
        toast({ title: "Vehicle asset created" });
        setCreateOpen(false);
        qc.invalidateQueries({ queryKey: ["assets"] });
        window.location.href = `/admin/assets/${result.asset.id}`;
      } else {
        if (!solarForm.customerId || !solarForm.serviceLocationId || !solarForm.siteName.trim() || !solarForm.panelCapacityKw.trim()) {
          toast({ title: "Customer, location, site name, and capacity are required", variant: "destructive" });
          return;
        }
        const result = await createAsset({
          assetType: "solar_site",
          customerId: parseInt(solarForm.customerId, 10),
          serviceLocationId: parseInt(solarForm.serviceLocationId, 10),
          siteName: solarForm.siteName.trim(),
          panelCapacityKw: solarForm.panelCapacityKw.trim(),
          panelCount: solarForm.panelCount ? parseInt(solarForm.panelCount, 10) : 1,
          notes: solarForm.notes || undefined,
        });
        toast({ title: "Solar asset created" });
        setCreateOpen(false);
        qc.invalidateQueries({ queryKey: ["assets"] });
        window.location.href = `/admin/assets/${result.asset.id}`;
      }
    } catch (err) {
      toast({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <Layers size={24} className="text-primary" /> Assets
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Vehicles, solar sites, and future asset types — placed at service locations
            </p>
            {filterCustomerId && (
              <Link href="/admin/assets" className="text-xs text-primary hover:underline mt-1 inline-block">
                Clear customer filter
              </Link>
            )}
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-add-asset">
                <Plus size={15} className="mr-1.5" />Add asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New asset</DialogTitle></DialogHeader>
              {!serviceLocationCustomerId && (
                <p className="text-sm text-muted-foreground">
                  Open from a customer context or set customer ID to load service locations.
                </p>
              )}
              <Tabs value={createTab} onValueChange={v => setCreateTab(v as "vehicle" | "solar_site")}>
                <TabsList className="w-full">
                  <TabsTrigger value="vehicle" className="flex-1"><Car size={14} className="mr-1" />Vehicle</TabsTrigger>
                  <TabsTrigger value="solar_site" className="flex-1"><Sun size={14} className="mr-1" />Solar site</TabsTrigger>
                </TabsList>
                <TabsContent value="vehicle" className="mt-4">
                  <div className="mb-3">
                    <label className="text-sm font-medium">Customer ID</label>
                    <Input
                      className="mt-1"
                      value={vehicleForm.customerId}
                      onChange={e => setVehicleForm(f => ({ ...f, customerId: e.target.value }))}
                      placeholder={filterCustomerId ? String(filterCustomerId) : "Customer ID"}
                    />
                  </div>
                  <VehicleForm
                    values={vehicleForm}
                    onChange={setVehicleForm}
                    selectedModel={selectedModel}
                    onModelSelect={setSelectedModel}
                    serviceLocations={serviceLocations}
                    showCustomerSelect={false}
                  />
                </TabsContent>
                <TabsContent value="solar_site" className="mt-4">
                  <div className="mb-3">
                    <label className="text-sm font-medium">Customer ID</label>
                    <Input
                      className="mt-1"
                      value={solarForm.customerId}
                      onChange={e => setSolarForm(f => ({ ...f, customerId: e.target.value }))}
                    />
                  </div>
                  <SolarSiteForm values={solarForm} onChange={setSolarForm} serviceLocations={serviceLocations} />
                </TabsContent>
              </Tabs>
              <Button onClick={handleCreate} disabled={creating || !serviceLocationCustomerId} className="w-full mt-4">
                {creating ? "Creating..." : "Create asset"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "vehicle", "solar_site"] as const).map(t => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? "default" : "outline"}
              className={typeFilter === t ? "bg-primary text-secondary" : ""}
              onClick={() => setTypeFilter(t)}
            >
              {t === "all" ? "All" : ASSET_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search label..." className="pl-9" />
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            : rows.map(row => (
              <Link key={row.id} href={`/admin/assets/${row.id}`}>
                <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors h-full" data-testid={`asset-card-${row.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    {row.assetType === "vehicle" ? <Car size={18} className="text-primary" /> : <Sun size={18} className="text-primary" />}
                    <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                  </div>
                  <h3 className="font-semibold mt-2">{row.label}</h3>
                  <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[row.assetType]}</p>
                  {row.serviceLocationLabel && (
                    <p className="text-xs text-muted-foreground mt-1">@ {row.serviceLocationLabel}</p>
                  )}
                </div>
              </Link>
            ))}
        </div>
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No assets found.</p>
        )}
      </div>
    </AdminLayout>
  );
}
