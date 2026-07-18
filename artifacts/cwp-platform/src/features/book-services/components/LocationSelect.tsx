import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Plus } from "lucide-react";
import {
  listServiceLocations,
  SERVICE_LOCATION_TYPE_LABELS,
  type CustomerServiceLocationRow,
  type ServiceLocationType,
} from "@/features/service-locations/api";
import { cn } from "@/lib/utils";
import { InlineServiceAddressForm } from "./InlineServiceAddressForm";

type Props = {
  customerId: number | null;
  /** Prefer the asset's registered site when present. */
  preferredLocationId?: number | null;
  value: CustomerServiceLocationRow | null;
  onChange: (location: CustomerServiceLocationRow | null) => void;
};

export function LocationSelect({ customerId, preferredLocationId, value, onChange }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ServiceLocationType | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["book-services", "locations", customerId],
    queryFn: () => listServiceLocations({ customerId: customerId!, limit: 50 }),
    enabled: customerId != null && customerId > 0,
  });

  const addresses = (data?.data ?? []) as CustomerServiceLocationRow[];

  /** Only location types that exist on this customer's sites (from the platform enum labels). */
  const availableTypes = useMemo(() => {
    const present = new Set(addresses.map(a => a.locationType));
    return (Object.keys(SERVICE_LOCATION_TYPE_LABELS) as ServiceLocationType[])
      .filter(t => present.has(t));
  }, [addresses]);

  const visible = typeFilter
    ? addresses.filter(a => a.locationType === typeFilter)
    : addresses;

  useEffect(() => {
    if (!customerId || value || addresses.length === 0) return;
    const preferred = preferredLocationId
      ? addresses.find(l => l.id === preferredLocationId)
      : undefined;
    const defaultLoc = preferred ?? addresses.find(l => l.isDefault) ?? addresses[0];
    if (defaultLoc) onChange(defaultLoc);
  }, [customerId, addresses, value, onChange, preferredLocationId]);

  useEffect(() => {
    setShowAddForm(false);
    setTypeFilter(null);
  }, [customerId]);

  if (!customerId) {
    return <p className="text-sm text-muted-foreground">Select a customer first.</p>;
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (addresses.length === 0 && !showAddForm) {
    return (
      <div className="space-y-3" data-testid="book-step-location">
        <div>
          <Label className="text-base">Where should CWP perform this service?</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a service location to continue — you stay in this request.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowAddForm(true)} data-testid="btn-add-service-address-inline">
          <Plus size={14} className="mr-1.5" /> Add service location
        </Button>
      </div>
    );
  }

  if (showAddForm) {
    return (
      <div className="space-y-3" data-testid="book-step-location">
        <InlineServiceAddressForm
          customerId={customerId}
          onCreated={loc => {
            setShowAddForm(false);
            onChange(loc);
            void refetch();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="book-step-location">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-base">Where should CWP perform this service?</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Location types come from the Address Platform. One site is pre-selected when possible.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs h-8" onClick={() => setShowAddForm(true)}>
          <Plus size={12} className="mr-1" /> Add location
        </Button>
      </div>

      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Location type">
          <button
            type="button"
            onClick={() => setTypeFilter(null)}
            data-testid="book-location-type-all"
            className={cn(
              "min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              typeFilter === null ? "border-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            All ({addresses.length})
          </button>
          {availableTypes.map(type => {
            const selected = typeFilter === type;
            const count = addresses.filter(a => a.locationType === type).length;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(selected ? null : type)}
                data-testid={`book-location-type-${type}`}
                className={cn(
                  "min-h-9 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {SERVICE_LOCATION_TYPE_LABELS[type]} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-2" role="listbox" aria-label="Service locations">
        {(visible.length > 0 ? visible : addresses).map(loc => {
          const selected = value?.id === loc.id;
          const fromAsset = preferredLocationId === loc.id;
          return (
            <button
              key={loc.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(loc)}
              data-testid={`book-location-${loc.id}`}
              className={cn(
                "text-left border rounded-lg px-4 py-3 transition-colors min-h-14",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin size={16} className="text-primary mt-0.5 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{loc.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {SERVICE_LOCATION_TYPE_LABELS[loc.locationType]}
                      {loc.city ? ` · ${loc.city}` : ""}
                    </p>
                    {loc.address && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{loc.address}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {loc.isDefault && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                  {fromAsset && <Badge variant="outline" className="text-xs">Asset site</Badge>}
                  {selected && <Badge className="text-xs">Selected</Badge>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
