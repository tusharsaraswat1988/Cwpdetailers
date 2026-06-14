import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink } from "lucide-react";
import {
  listServiceLocations,
  SERVICE_LOCATION_TYPE_LABELS,
  type CustomerServiceLocationRow,
} from "@/features/service-locations/api";

type CustomerServiceLocationsPanelProps = {
  customerId: number;
  readOnly?: boolean;
};

export function CustomerServiceLocationsPanel({
  customerId,
  readOnly = true,
}: CustomerServiceLocationsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["service-locations", "customer", customerId],
    queryFn: () => listServiceLocations({ customerId, limit: 50 }),
  });

  const rows = (data?.data ?? []) as CustomerServiceLocationRow[];

  return (
    <Card data-testid="customer-service-locations-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Service Locations
        </CardTitle>
        <Link href={`/admin/service-locations?customerId=${customerId}`}>
          <Button variant="ghost" size="sm" className="text-xs h-8" data-testid="btn-open-service-locations">
            <ExternalLink size={12} className="mr-1" /> Open module
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No linked service locations yet. New customers receive a default &quot;Primary&quot; location automatically.
          </p>
        ) : (
          rows.map(loc => (
            <div
              key={loc.linkId ?? loc.id}
              className="border border-border rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-3"
              data-testid={`customer-location-row-${loc.id}`}
            >
              <div>
                <p className="font-medium">{loc.label}</p>
                <p className="text-xs text-muted-foreground">
                  {SERVICE_LOCATION_TYPE_LABELS[loc.locationType]}
                  {loc.city ? ` · ${loc.city}` : ""}
                </p>
                {loc.address && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{loc.address}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loc.effectiveFrom ?? "—"} → {loc.effectiveUntil ?? "open"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {loc.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                {loc.isAutoCreated && <Badge variant="outline" className="text-xs">Auto</Badge>}
                {!readOnly ? null : (
                  <Link href={`/admin/service-locations/${loc.id}`} className="text-xs text-primary hover:underline">
                    View
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
        {readOnly && (
          <p className="text-xs text-muted-foreground pt-2">
            Read-only in Customer 360. Manage locations in the Service Locations module.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
