import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, Sun, Plus } from "lucide-react";
import { listAssets, type AssetListRow } from "@/features/assets/api";

const TYPE_LABELS: Record<string, string> = {
  vehicle: "Vehicle",
  solar_site: "Solar site",
};

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
        <Link href={`/admin/book-services?customerId=${customerId}`}>
          <Button variant="outline" size="sm" className="text-xs h-8 shrink-0" data-testid="btn-add-customer-vehicle">
            <Plus size={12} className="mr-1" /> Book service
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vehicles or solar sites yet. They are added when you book a service for this customer.
          </p>
        ) : (
          rows.map((row: AssetListRow) => (
            <div
              key={row.id}
              className="border border-border rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-3"
              data-testid={`customer-vehicle-row-${row.id}`}
            >
              <div className="flex items-start gap-2">
                {row.assetType === "vehicle" ? <Car size={14} className="text-primary mt-0.5" /> : <Sun size={14} className="text-primary mt-0.5" />}
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{TYPE_LABELS[row.assetType] ?? row.assetType}</p>
                  {row.serviceLocationLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">At {row.serviceLocationLabel}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-xs capitalize shrink-0">{row.status}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
