import { useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import StaffLayout from "@/components/layout/StaffLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MapPin, User } from "lucide-react";

export default function StaffSchedule() {
  const { data, isLoading } = useListBookings({ staffId: "1", limit: "30" } as any, {
    query: { queryKey: getListBookingsQueryKey({ staffId: "1" } as any) }
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    confirmed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    in_progress: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
    cancelled: "bg-muted text-muted-foreground border-muted",
  };

  return (
    <StaffLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">My Schedule</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Upcoming and past assignments</p>
        </div>

        <div className="space-y-3">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />) :
            (data?.data ?? []).map(b => (
              <div key={b.id} className="bg-card border border-border rounded-xl p-4" data-testid={`schedule-job-${b.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User size={13} className="text-muted-foreground" />
                      <span className="font-semibold text-sm">{b.customerName}</span>
                      <span className="text-xs text-muted-foreground">({b.customerPhone})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar size={11} />
                      <span>{b.scheduledDate}</span>
                      {b.scheduledTime && <><Clock size={11} /><span>{b.scheduledTime}</span></>}
                    </div>
                    {b.address && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin size={11} />
                        <span>{b.address}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">{b.serviceType?.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant="outline" className={`text-xs capitalize ${statusColors[b.status ?? "pending"]}`}>
                      {b.status?.replace(/_/g, " ")}
                    </Badge>
                    {b.amount && <p className="text-sm font-semibold mt-1 text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</p>}
                    {b.rating && <p className="text-xs text-primary mt-0.5">{"★".repeat(b.rating)}</p>}
                  </div>
                </div>
              </div>
            ))}
          {!isLoading && (data?.data ?? []).length === 0 && (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">No assignments found</div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}
