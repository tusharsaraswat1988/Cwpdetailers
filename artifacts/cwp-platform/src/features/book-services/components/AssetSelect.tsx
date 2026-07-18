import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Sun, Plus, Layers } from "lucide-react";
import {
  ASSET_TYPE_LABELS,
  listAssets,
  type AssetListRow,
  type AssetType,
} from "@/features/assets/api";
import { listServiceLocations, type CustomerServiceLocationRow } from "@/features/service-locations/api";
import { cn } from "@/lib/utils";
import { InlineVehicleSolarForm } from "./InlineVehicleSolarForm";
import { InlineServiceAddressForm } from "./InlineServiceAddressForm";

type AssetFilter = "all" | AssetType;

const FILTERS: Array<{ id: AssetFilter; label: string; icon: typeof Car }> = [
  { id: "all", label: "All", icon: Layers },
  ...(Object.entries(ASSET_TYPE_LABELS) as Array<[AssetType, string]>).map(([id, label]) => ({
    id,
    label,
    icon: id === "solar_site" ? Sun : Car,
  })),
];

type Props = {
  customerId: number | null;
  value: AssetListRow | null;
  onChange: (asset: AssetListRow | null) => void;
};

export function AssetSelect({ customerId, value, onChange }: Props) {
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [createLocationId, setCreateLocationId] = useState<number | null>(null);
  const [showAddressForCreate, setShowAddressForCreate] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["book-services", "assets", customerId, "all"],
    queryFn: () => listAssets({ customerId: customerId!, limit: 50 }),
    enabled: Boolean(customerId),
  });

  const { data: locData, isLoading: locLoading, refetch: refetchLocs } = useQuery({
    queryKey: ["book-services", "locations", customerId],
    queryFn: () => listServiceLocations({ customerId: customerId!, limit: 50 }),
    enabled: Boolean(customerId && showAddForm),
  });

  const allAssets = data?.data ?? [];
  const assets = filter === "all"
    ? allAssets
    : allAssets.filter(a => a.assetType === filter);
  const locations = (locData?.data ?? []) as CustomerServiceLocationRow[];

  useEffect(() => {
    setShowAddForm(false);
    setShowAddressForCreate(false);
    setCreateLocationId(null);
    setFilter("all");
  }, [customerId]);

  // Preselect when there is exactly one asset on file and nothing chosen yet.
  useEffect(() => {
    if (!customerId || value || isLoading || filter !== "all") return;
    if (allAssets.length === 1) onChange(allAssets[0]!);
  }, [customerId, allAssets, value, isLoading, filter, onChange]);

  useEffect(() => {
    if (!showAddForm || createLocationId || locations.length === 0) return;
    const preferred = locations.find(l => l.isDefault) ?? locations[0];
    if (preferred) setCreateLocationId(preferred.id);
  }, [showAddForm, locations, createLocationId]);

  if (!customerId) {
    return <p className="text-sm text-muted-foreground">Select a customer first.</p>;
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const createLocation = locations.find(l => l.id === createLocationId) ?? null;
  const defaultAssetType: AssetType = filter === "solar_site" ? "solar_site" : "vehicle";

  if (showAddForm) {
    if (locLoading) return <Skeleton className="h-24 w-full" />;

    if (showAddressForCreate || locations.length === 0) {
      return (
        <div className="space-y-3" data-testid="book-step-asset">
          <div>
            <Label className="text-base">Where is this asset based?</Label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Assets need a registered site. Add one here — you can still choose where service happens next.
            </p>
          </div>
          <InlineServiceAddressForm
            customerId={customerId}
            onCreated={loc => {
              setCreateLocationId(loc.id);
              setShowAddressForCreate(false);
              void refetchLocs();
            }}
            onCancel={locations.length > 0 ? () => setShowAddressForCreate(false) : () => setShowAddForm(false)}
          />
        </div>
      );
    }

    return (
      <div className="space-y-3" data-testid="book-step-asset">
        {locations.length > 1 && (
          <div className="space-y-2">
            <Label>Register asset at</Label>
            <div className="grid gap-2">
              {locations.map(loc => {
                const selected = createLocationId === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setCreateLocationId(loc.id)}
                    className={cn(
                      "text-left border rounded-lg px-3 py-2.5 text-sm transition-colors min-h-11",
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="font-medium">{loc.label}</span>
                    {loc.city ? <span className="text-muted-foreground"> · {loc.city}</span> : null}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowAddressForCreate(true)}
            >
              <Plus size={12} className="mr-1" /> New site for this asset
            </Button>
          </div>
        )}
        {createLocationId && createLocation && (
          <InlineVehicleSolarForm
            customerId={customerId}
            serviceLocationId={createLocationId}
            serviceLocationLabel={createLocation.label ?? createLocation.address ?? undefined}
            defaultTab={defaultAssetType}
            onCreated={asset => {
              setShowAddForm(false);
              onChange(asset);
              void refetch();
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="book-step-asset">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-base">What needs service today?</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick an existing asset, or register one without leaving this request.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs h-8"
          onClick={() => setShowAddForm(true)}
          data-testid="btn-add-vehicle-inline"
        >
          <Plus size={12} className="mr-1" /> Register new
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Asset type">
        {FILTERS.map(f => {
          const Icon = f.icon;
          const selected = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(f.id)}
              data-testid={`book-asset-filter-${f.id}`}
              className={cn(
                "min-h-[4.5rem] rounded-lg border px-3 py-3 text-left transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <Icon className={cn("h-4 w-4 mb-1.5", selected ? "text-primary" : "text-muted-foreground")} aria-hidden />
              <p className="text-sm font-medium">{f.label}</p>
            </button>
          );
        })}
      </div>

      {assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No {filter === "all" ? "assets" : (ASSET_TYPE_LABELS[filter] ?? filter).toLowerCase()} on file yet.
          </p>
          <Button type="button" variant="outline" onClick={() => setShowAddForm(true)}>
            <Plus size={14} className="mr-1.5" /> Register one now
          </Button>
        </div>
      ) : (
        <div className="grid gap-2" role="listbox" aria-label="Customer assets">
          {assets.map(item => {
            const selected = value?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange(item)}
                data-testid={`book-asset-${item.id}`}
                className={cn(
                  "text-left border rounded-lg px-4 py-3 transition-colors min-h-14",
                  selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-start gap-2">
                  {item.assetType === "vehicle"
                    ? <Car size={16} className="text-primary mt-0.5" aria-hidden />
                    : <Sun size={16} className="text-primary mt-0.5" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ASSET_TYPE_LABELS[item.assetType] ?? item.assetType}
                      {item.serviceLocationLabel ? ` · ${item.serviceLocationLabel}` : ""}
                    </p>
                  </div>
                  {selected && <Badge className="text-xs shrink-0">Selected</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
