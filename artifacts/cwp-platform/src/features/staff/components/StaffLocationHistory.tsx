import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchStaffLocationLogs, LOCATION_ACTION_LABELS, mapsLink } from "@/lib/location";
import { ExternalLink, MapPin, ShieldCheck, ShieldX } from "lucide-react";

export function StaffLocationHistory({ staffId, month }: { staffId: number; month?: string }) {
  const monthFilter = month ?? new Date().toISOString().slice(0, 7);
  const { data, isLoading } = useQuery({
    queryKey: ["staff-location-logs", staffId, monthFilter],
    queryFn: () => fetchStaffLocationLogs(staffId, monthFilter),
    enabled: staffId > 0,
  });

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No location events this month. Logs appear when staff checks in or updates job status from the field app.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {data.map(row => (
        <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-lg p-3 text-sm">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{LOCATION_ACTION_LABELS[row.action] ?? row.action}</span>
              {row.bookingId && (
                <Badge variant="outline" className="text-[10px]">Booking #{row.bookingId}</Badge>
              )}
              {row.geoFenceVerified === true && (
                <Badge className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30">
                  <ShieldCheck size={10} className="mr-1" />In zone
                </Badge>
              )}
              {row.geoFenceVerified === false && (
                <Badge variant="destructive" className="text-[10px]">
                  <ShieldX size={10} className="mr-1" />Outside zone
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(row.recordedAt).toLocaleString("en-IN")}
              {row.accuracyMeters != null && ` · ±${Math.round(row.accuracyMeters)}m GPS`}
              {row.distanceMeters != null && row.geoFenceRadiusMeters != null && (
                ` · ${Math.round(row.distanceMeters)}m from customer (${row.geoFenceRadiusMeters}m allowed)`
              )}
            </p>
            <p className="text-xs font-mono text-muted-foreground truncate">
              {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild className="shrink-0">
            <a href={mapsLink(row.latitude, row.longitude)} target="_blank" rel="noreferrer">
              <MapPin size={12} className="mr-1" />
              Map
              <ExternalLink size={10} className="ml-1 opacity-50" />
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}
