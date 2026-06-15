import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import {
  listServiceLocations,
  SERVICE_LOCATION_TYPE_LABELS,
  type CustomerServiceLocationRow,
} from "@/features/service-locations/api";

type CustomerServiceLocationsPanelProps = {
  customerId: number;
};

export function CustomerServiceLocationsPanel({ customerId }: CustomerServiceLocationsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["service-locations", "customer", customerId],
    queryFn: () => listServiceLocations({ customerId, limit: 50 }),
  });

  const rows = (data?.data ?? []) as CustomerServiceLocationRow[];

  return (
    <Card data-testid="customer-service-addresses-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Service addresses
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Where we go for this customer&apos;s jobs</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No service addresses yet. Add one when you{" "}
            <Link href={`/admin/book-services?customerId=${customerId}`} className="text-primary hover:underline">
              book a service
            </Link>
            .
          </p>
        ) : (
          rows.map(loc => (
            <div
              key={loc.linkId ?? loc.id}
              className="border border-border rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-3"
              data-testid={`customer-address-row-${loc.id}`}
            >
              <div>
                <p className="font-medium">{loc.label}</p>
                <p className="text-xs text-muted-foreground">
                  {SERVICE_LOCATION_TYPE_LABELS[loc.locationType]}
                  {loc.city ? ` · ${loc.city}` : ""}
                </p>
                {loc.address && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{loc.address}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {loc.isDefault && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                {loc.isAutoCreated && <Badge variant="outline" className="text-xs">Auto</Badge>}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
