import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Car, Sun } from "lucide-react";
import { listAssets, ASSET_TYPE_LABELS, type AssetListRow } from "@/features/assets/api";
import { cn } from "@/lib/utils";

type Props = {
  customerId: number | null;
  serviceLocationId: number | null;
  value: AssetListRow | null;
  onChange: (asset: AssetListRow | null) => void;
};

export function AssetSelect({ customerId, serviceLocationId, value, onChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["book-services", "assets", customerId, serviceLocationId],
    queryFn: () => listAssets({
      customerId: customerId!,
      serviceLocationId: serviceLocationId!,
      limit: 50,
    }),
    enabled: Boolean(customerId && serviceLocationId),
  });

  const assets = data?.data ?? [];

  if (!customerId || !serviceLocationId) {
    return <p className="text-sm text-muted-foreground">Select a service location first.</p>;
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (assets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No assets at this location. Register vehicles or solar sites in the Assets module and place them at this site.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="book-step-asset">
      <div>
        <Label>Which asset is being serviced?</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Only assets placed at the selected location are shown.
        </p>
      </div>
      <div className="grid gap-2">
        {assets.map(asset => {
          const selected = value?.id === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => onChange(asset)}
              data-testid={`book-asset-${asset.id}`}
              className={cn(
                "text-left border rounded-lg px-4 py-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start gap-2">
                {asset.assetType === "vehicle"
                  ? <Car size={16} className="text-primary mt-0.5" />
                  : <Sun size={16} className="text-primary mt-0.5" />}
                <div>
                  <p className="font-medium text-sm">{asset.label}</p>
                  <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[asset.assetType]}</p>
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
