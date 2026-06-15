import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Sun, Plus } from "lucide-react";
import { listAssets, type AssetListRow } from "@/features/assets/api";
import { cn } from "@/lib/utils";
import { InlineVehicleSolarForm } from "./InlineVehicleSolarForm";

const TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  solar_site: "Solar site",
};

type Props = {
  customerId: number | null;
  serviceLocationId: number | null;
  value: AssetListRow | null;
  onChange: (asset: AssetListRow | null) => void;
};

export function AssetSelect({ customerId, serviceLocationId, value, onChange }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["book-services", "assets", customerId, serviceLocationId],
    queryFn: () => listAssets({
      customerId: customerId!,
      serviceLocationId: serviceLocationId!,
      limit: 50,
    }),
    enabled: Boolean(customerId && serviceLocationId),
  });

  const vehicles = data?.data ?? [];

  useEffect(() => {
    setShowAddForm(false);
  }, [customerId, serviceLocationId]);

  if (!customerId || !serviceLocationId) {
    return <p className="text-sm text-muted-foreground">Select a service address first.</p>;
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (vehicles.length === 0 && !showAddForm) {
    return (
      <div className="space-y-3" data-testid="book-step-asset">
        <div>
          <Label>Which vehicle or solar site?</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Register the customer&apos;s car or solar site here — no need to leave this booking.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowAddForm(true)} data-testid="btn-add-vehicle-inline">
          <Plus size={14} className="mr-1.5" /> Add vehicle or solar site
        </Button>
      </div>
    );
  }

  if (showAddForm) {
    return (
      <div className="space-y-3" data-testid="book-step-asset">
        <InlineVehicleSolarForm
          customerId={customerId}
          serviceLocationId={serviceLocationId}
          onCreated={asset => {
            setShowAddForm(false);
            onChange(asset);
            void refetch();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="book-step-asset">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label>Which vehicle or solar site?</Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Only items registered at the selected service address are shown.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs h-8" onClick={() => setShowAddForm(true)}>
          <Plus size={12} className="mr-1" /> Add another
        </Button>
      </div>
      <div className="grid gap-2">
        {vehicles.map(item => {
          const selected = value?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item)}
              data-testid={`book-asset-${item.id}`}
              className={cn(
                "text-left border rounded-lg px-4 py-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start gap-2">
                {item.assetType === "vehicle"
                  ? <Car size={16} className="text-primary mt-0.5" />
                  : <Sun size={16} className="text-primary mt-0.5" />}
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[item.assetType] ?? item.assetType}</p>
                </div>
                {selected && <Badge className="ml-auto text-xs">Selected</Badge>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
