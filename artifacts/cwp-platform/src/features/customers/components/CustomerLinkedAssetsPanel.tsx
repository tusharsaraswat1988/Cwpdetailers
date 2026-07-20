import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Sun, Plus, Pencil } from "lucide-react";
import { ASSET_TYPE_LABELS, listAssets, type AssetListRow } from "@/features/assets/api";

type CustomerVehiclesPanelProps = {
  customerId: number;
};

export function CustomerLinkedAssetsPanel({ customerId }: CustomerVehiclesPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["assets", "customer", customerId],
    queryFn: () => listAssets({ customerId, limit: 50 }),
  });

  const rows = data?.data ?? [];

  return (
    <Card data-testid="customer-vehicles-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Car size={16} className="text-primary" /> Vehicles &amp; solar sites
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Registered when booking — shown on each job</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/admin/assets?customerId=${customerId}`}>
            <Button variant="ghost" size="sm" className="text-xs h-8" data-testid="btn-manage-customer-assets">
              Manage
            </Button>
          </Link>
          <Link href={`/admin/book-services?customerId=${customerId}`}>
            <Button variant="outline" size="sm" className="text-xs h-8" data-testid="btn-add-customer-vehicle">
              <Plus size={12} className="mr-1" /> Service request
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vehicles or solar sites yet. They are added when you create a service request for this customer.
          </p>
        ) : (
          rows.map((row: AssetListRow) => (
            <div
              key={row.id}
              className="border border-border rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-3"
              data-testid={`customer-vehicle-row-${row.id}`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {row.assetType === "vehicle" ? <Car size={14} className="text-primary mt-0.5" /> : <Sun size={14} className="text-primary mt-0.5" />}
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[row.assetType] ?? row.assetType}</p>
                  {row.serviceLocationLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">At {row.serviceLocationLabel}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                <Link href={`/admin/assets/${row.id}`}>
                  <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" data-testid={`customer-asset-edit-${row.id}`}>
                    <Pencil size={12} />
                    Edit
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
