import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { listServiceLocations, SERVICE_LOCATION_TYPE_LABELS, type CustomerServiceLocationRow } from "@/features/service-locations/api";
import { cn } from "@/lib/utils";

type Props = {
  customerId: number | null;
  value: CustomerServiceLocationRow | null;
  onChange: (location: CustomerServiceLocationRow | null) => void;
};

export function LocationSelect({ customerId, value, onChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["book-services", "locations", customerId],
    queryFn: () => listServiceLocations({ customerId: customerId!, limit: 50 }),
    enabled: customerId != null && customerId > 0,
  });

  const locations = (data?.data ?? []) as CustomerServiceLocationRow[];

  useEffect(() => {
    if (!customerId || value || locations.length === 0) return;
    const defaultLoc = locations.find(l => l.isDefault) ?? locations[0];
    if (defaultLoc) onChange(defaultLoc);
  }, [customerId, locations, value, onChange]);

  if (!customerId) {
    return <p className="text-sm text-muted-foreground">Select a customer first.</p>;
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No service locations linked to this customer. Add locations in the Service Locations module first.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="book-step-location">
      <div>
        <Label>Where will the work happen?</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose the site for this job. Your primary location is pre-selected when available.
        </p>
      </div>
      <div className="grid gap-2">
        {locations.map(loc => {
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
