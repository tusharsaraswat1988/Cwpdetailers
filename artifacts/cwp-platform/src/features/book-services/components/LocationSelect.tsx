import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Plus } from "lucide-react";
import { listServiceLocations, SERVICE_LOCATION_TYPE_LABELS, type CustomerServiceLocationRow } from "@/features/service-locations/api";
import { cn } from "@/lib/utils";
import { InlineServiceAddressForm } from "./InlineServiceAddressForm";

type Props = {
  customerId: number | null;
  value: CustomerServiceLocationRow | null;
  onChange: (location: CustomerServiceLocationRow | null) => void;
};

export function LocationSelect({ customerId, value, onChange }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["book-services", "locations", customerId],
    queryFn: () => listServiceLocations({ customerId: customerId!, limit: 50 }),
    enabled: customerId != null && customerId > 0,
  });

  const addresses = (data?.data ?? []) as CustomerServiceLocationRow[];

  useEffect(() => {
    if (!customerId || value || addresses.length === 0) return;
    const defaultLoc = addresses.find(l => l.isDefault) ?? addresses[0];
    if (defaultLoc) onChange(defaultLoc);
  }, [customerId, addresses, value, onChange]);

  useEffect(() => {
    setShowAddForm(false);
  }, [customerId]);

  if (!customerId) {
    return <p className="text-sm text-muted-foreground">Select a customer first.</p>;
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (addresses.length === 0 && !showAddForm) {
    return (
      <div className="space-y-3" data-testid="book-step-location">
        <div>
          <Label>Service address</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Where should we go for this job? Add an address to continue — you stay in this booking.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowAddForm(true)} data-testid="btn-add-service-address-inline">
          <Plus size={14} className="mr-1.5" /> Add service address
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
    <div className="space-y-3" data-testid="book-step-location">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label>Service address</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Where should we go for this job? The primary address is pre-selected when available.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs h-8" onClick={() => setShowAddForm(true)}>
          <Plus size={12} className="mr-1" /> Add address
        </Button>
      </div>
      <div className="grid gap-2">
        {addresses.map(loc => {
          const selected = value?.id === loc.id;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => onChange(loc)}
              data-testid={`book-location-${loc.id}`}
              className={cn(
                "text-left border rounded-lg px-4 py-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                  <div>
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
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
