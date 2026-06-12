import { useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Star, Image } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  confirmed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-muted text-muted-foreground border-muted",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  en_route: "bg-primary/10 text-primary border-primary/20",
  rescheduled: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export default function CustomerHistory() {
  const { data, isLoading } = useListBookings({ customerId: "1" } as any, {
    query: { queryKey: getListBookingsQueryKey({ customerId: "1" } as any) }
  });

  const photos = (b: any) => {
    const urls: string[] = (b.proofPhotoUrls as string[] | null) ?? [];
    if (b.beforePhotoUrl) urls.unshift(b.beforePhotoUrl);
    if (b.afterPhotoUrl) urls.push(b.afterPhotoUrl);
    return urls;
  };

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">Service History</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total services</p>
        </div>

        <div className="space-y-3">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />) :
            (data?.data ?? []).map(b => (
              <div key={b.id} className="bg-card border border-border rounded-xl p-4" data-testid={`history-booking-${b.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Calendar size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{b.serviceName ?? b.serviceType?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{b.scheduledDate} {b.scheduledTime ? `at ${b.scheduledTime}` : ""}</p>
                      {b.staffName && <p className="text-xs text-muted-foreground">by {b.staffName}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-xs capitalize ${statusColors[b.status ?? "pending"]}`}>
                      {b.status?.replace(/_/g, " ")}
                    </Badge>
                    {b.amount && <p className="text-sm font-semibold mt-1">₹{Number(b.amount).toLocaleString("en-IN")}</p>}
                    {b.rating && (
                      <div className="flex items-center justify-end gap-0.5 mt-1">
                        {Array.from({ length: b.rating }).map((_, i) => <Star key={i} size={10} fill="currentColor" className="text-primary" />)}
                      </div>
                    )}
                  </div>
                </div>
                {/* Proof thumbnails */}
                {photos(b).length > 0 && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <Image size={12} className="text-muted-foreground" />
                    <div className="flex items-center gap-1.5">
                      {photos(b).slice(0, 3).map((url: string, i: number) => (
                        <img key={i} src={url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                      ))}
                      {photos(b).length > 3 && (
                        <span className="text-xs text-muted-foreground">+{photos(b).length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          {!isLoading && (data?.data ?? []).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No service history yet</div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
