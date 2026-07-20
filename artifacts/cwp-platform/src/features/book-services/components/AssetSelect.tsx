import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Sun, Plus, Layers, MapPin, Pencil } from "lucide-react";
import {
  ASSET_TYPE_LABELS,
  listAssets,
  type AssetListRow,
  type AssetType,
} from "@/features/assets/api";
import { listServiceLocations, type CustomerServiceLocationRow } from "@/features/service-locations/api";
import { cn } from "@/lib/utils";
import { InlineVehicleSolarForm, toLocationOptions } from "./InlineVehicleSolarForm";
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

function formatLocationLine(loc: CustomerServiceLocationRow) {
  return [loc.address, loc.city].filter(Boolean).join(", ");
}

export function AssetSelect({ customerId, value, onChange }: Props) {
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [createLocationId, setCreateLocationId] = useState<number | null>(null);
  const [showAddressForCreate, setShowAddressForCreate] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CustomerServiceLocationRow | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["book-services", "assets", customerId, "all"],
    queryFn: () => listAssets({ customerId: customerId!, limit: 50 }),
    enabled: Boolean(customerId),
  });

  const { data: locData, isLoading: locLoading, refetch: refetchLocs } = useQuery({
    queryKey: ["book-services", "locations", customerId],
    queryFn: () => listServiceLocations({ customerId: customerId!, limit: 50 }),
    enabled: Boolean(customerId && (showAddForm || editingLocation != null || Boolean(value?.serviceLocationId))),
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
    setEditingLocation(null);
    setFilter("all");
  }, [customerId]);

  // Preselect when there is exactly one asset on file and nothing chosen yet.
  useEffect(() => {
    if (!customerId || value || isLoading || filter !== "all") return;
    if (allAssets.length === 1) onChange(allAssets[0]!);
  }, [customerId, allAssets, value, isLoading, filter, onChange]);

  // When addresses load, preselect default/first — but never hide the picker
  useEffect(() => {
    if (!showAddForm || locations.length === 0) return;
    if (createLocationId && locations.some(l => l.id === createLocationId)) return;
    const preferred = locations.find(l => l.isDefault) ?? locations[0];
    if (preferred) setCreateLocationId(preferred.id);
  }, [showAddForm, locations, createLocationId]);

  if (!customerId) {
    return <p className="text-sm text-muted-foreground">Select a customer first.</p>;
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const defaultAssetType: AssetType = filter === "solar_site" ? "solar_site" : "vehicle";

  // Edit the selected asset's linked address without leaving the Asset step
  if (editingLocation && !showAddForm) {
    return (
      <div className="space-y-3" data-testid="book-step-asset">
        <div>
          <Label className="text-base">Edit service address</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Update “{editingLocation.label}” for this customer.
          </p>
        </div>
        <InlineServiceAddressForm
          customerId={customerId}
          editing={editingLocation}
          onCreated={() => {
            setEditingLocation(null);
            void refetch();
            void refetchLocs();
          }}
          onUpdated={() => {
            setEditingLocation(null);
            void refetch();
            void refetchLocs();
          }}
          onCancel={() => setEditingLocation(null)}
        />
      </div>
    );
  }

  if (showAddForm) {
    if (locLoading) return <Skeleton className="h-24 w-full" />;

    // No addresses → force add-address form (user types a real name)
    if (showAddressForCreate || locations.length === 0) {
      return (
        <div className="space-y-3" data-testid="book-step-asset">
          <div>
            <Label className="text-base">Service address</Label>
            <p className="text-sm text-muted-foreground mt-0.5">
              {locations.length === 0
                ? "This customer has no address yet. Add one with a clear name (Home, Office, Factory…)."
                : "Add another named address for this customer."}
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

    if (editingLocation) {
      return (
        <div className="space-y-3" data-testid="book-step-asset">
          <InlineServiceAddressForm
            customerId={customerId}
            editing={editingLocation}
            onCreated={loc => {
              setCreateLocationId(loc.id);
              setEditingLocation(null);
              void refetchLocs();
            }}
            onUpdated={loc => {
              setCreateLocationId(loc.id);
              setEditingLocation(null);
              void refetchLocs();
            }}
            onCancel={() => setEditingLocation(null)}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="book-step-asset">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Label className="text-base">Service address *</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pick where this asset is based, or add / edit a named address.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 h-8 text-xs"
              onClick={() => setShowAddressForCreate(true)}
              data-testid="btn-add-address-inline"
            >
              <Plus size={12} className="mr-1" /> New address
            </Button>
          </div>

          <div className="grid gap-2" role="listbox" aria-label="Service addresses">
            {locations.map(loc => {
              const selected = createLocationId === loc.id;
              const line = formatLocationLine(loc);
              return (
                <div
                  key={loc.id}
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "text-left border rounded-lg px-3 py-2.5 text-sm transition-colors min-h-11",
                    selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                  data-testid={`book-location-${loc.id}`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className="flex items-start gap-2 min-w-0 flex-1 text-left"
                      onClick={() => setCreateLocationId(loc.id)}
                    >
                      <MapPin size={14} className={cn("mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{loc.label || "Untitled"}</p>
                        {line ? (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{line}</p>
                        ) : (
                          <p className="text-xs text-amber-600 mt-0.5">No street address on file</p>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {selected && <Badge className="text-xs">Selected</Badge>}
                      {loc.isDefault && !selected && (
                        <Badge variant="outline" className="text-[10px]">Default</Badge>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs"
                        onClick={() => {
                          setCreateLocationId(loc.id);
                          setEditingLocation(loc);
                        }}
                        data-testid={`book-asset-location-edit-${loc.id}`}
                      >
                        <Pencil size={12} />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {createLocationId != null && (
          <InlineVehicleSolarForm
            customerId={customerId}
            serviceLocations={toLocationOptions(locations)}
            serviceLocationId={createLocationId}
            defaultTab={defaultAssetType}
            onAddAddress={() => setShowAddressForCreate(true)}
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
            const linkedLoc = item.serviceLocationId
              ? locations.find(l => l.id === item.serviceLocationId) ?? null
              : null;
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={selected}
                data-testid={`book-asset-${item.id}`}
                className={cn(
                  "text-left border rounded-lg px-4 py-3 transition-colors min-h-14",
                  selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="flex items-start gap-2 min-w-0 flex-1 text-left"
                    onClick={() => onChange(item)}
                  >
                    {item.assetType === "vehicle"
                      ? <Car size={16} className="text-primary mt-0.5" aria-hidden />
                      : <Sun size={16} className="text-primary mt-0.5" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {ASSET_TYPE_LABELS[item.assetType] ?? item.assetType}
                        {item.assetType === "solar_site" && item.panelCount != null
                          ? ` · ${item.panelCount} panels`
                          : ""}
                        {item.serviceLocationLabel ? ` · ${item.serviceLocationLabel}` : ""}
                      </p>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    {selected && <Badge className="text-xs">Selected</Badge>}
                    {selected && item.serviceLocationId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs"
                        disabled={locLoading && !linkedLoc}
                        onClick={() => {
                          onChange(item);
                          if (linkedLoc) {
                            setEditingLocation(linkedLoc);
                          } else {
                            void refetchLocs().then(result => {
                              const rows = (result.data?.data ?? []) as CustomerServiceLocationRow[];
                              const found = rows.find(l => l.id === item.serviceLocationId);
                              if (found) setEditingLocation(found);
                            });
                          }
                        }}
                        data-testid={`book-asset-edit-address-${item.id}`}
                      >
                        <Pencil size={12} />
                        Edit address
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
