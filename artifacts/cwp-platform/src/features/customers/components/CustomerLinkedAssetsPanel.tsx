import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Sun, ExternalLink, Layers } from "lucide-react";
import { listAssets, ASSET_TYPE_LABELS, type AssetListRow } from "@/features/assets/api";

type CustomerLinkedAssetsPanelProps = {
  customerId: number;
};

export function CustomerLinkedAssetsPanel({ customerId }: CustomerLinkedAssetsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["assets", "customer", customerId],
    queryFn: () => listAssets({ customerId, limit: 50 }),
  });

  const rows = data?.data ?? [];

  return (
    <Card data-testid="customer-linked-assets-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers size={16} className="text-primary" /> Linked Assets
        </CardTitle>
        <Link href={`/admin/assets?customerId=${customerId}`}>
          <Button variant="ghost" size="sm" className="text-xs h-8" data-testid="btn-open-assets-module">
            <ExternalLink size={12} className="mr-1" /> Open Assets
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No linked assets. Create vehicles and solar sites in the Assets module.
          </p>
        ) : (
          rows.map((row: AssetListRow) => (
            <div
              key={row.id}
              className="border border-border rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-3"
              data-testid={`customer-asset-row-${row.id}`}
            >
              <div className="flex items-start gap-2">
                {row.assetType === "vehicle" ? <Car size={14} className="text-primary mt-0.5" /> : <Sun size={14} className="text-primary mt-0.5" />}
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[row.assetType]}</p>
                  {row.serviceLocationLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">@ {row.serviceLocationLabel}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                <Link href={`/admin/assets/${row.id}`} className="text-xs text-primary hover:underline">View</Link>
              </div>
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground pt-2">
          Read-only in Customer 360. Manage assets in the Assets module.
        </p>
      </CardContent>
    </Card>
  );
}
