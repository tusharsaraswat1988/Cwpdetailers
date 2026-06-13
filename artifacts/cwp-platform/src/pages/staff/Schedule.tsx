import { useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import StaffLayout from "@/components/layout/StaffLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Calendar, Clock, MapPin, User } from "lucide-react";

function formatDateHeader(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

export default function StaffSchedule() {
  const { staffId, isLoading: scopeLoading, missingStaffLink } = useAccountScope();
  const { data, isLoading, isError, refetch } = useListBookings(
    { staffId: String(staffId ?? ""), limit: "30" } as any,
    {
      query: {
        queryKey: getListBookingsQueryKey({ staffId: String(staffId ?? ""), limit: "30" } as any),
        enabled: staffId != null,
      },
    },
  );

  // QW-15: group by date
  const grouped = (data?.data ?? []).reduce<Record<string, NonNullable<typeof data>["data"]>>((acc, b) => {
    const key = b.scheduledDate ?? "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();

  return (
    <StaffLayout>
      {scopeLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : missingStaffLink || staffId == null ? (
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a staff profile. Ask your admin to create your staff account.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="font-display font-bold text-xl">My Schedule</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Upcoming and past assignments</p>
          </div>

          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : sortedDates.length === 0 ? (
            <EmptyState
              icon={<Calendar size={20} />}
              title="No assignments found"
              description="Your upcoming bookings will appear here once scheduled"
            />
          ) : (
            <div className="space-y-5">
              {sortedDates.map(dateKey => (
                <div key={dateKey}>
                  {/* QW-15: Date group header */}
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                      {formatDateHeader(dateKey)}
                    </p>
                    <div className="flex-1 h-px bg-border" />
                    <p className="text-xs text-muted-foreground">{grouped[dateKey].length} job{grouped[dateKey].length !== 1 ? "s" : ""}</p>
                  </div>

                  <div className="space-y-3">
                    {grouped[dateKey].map(b => (
                      <div key={b.id} className="bg-card border border-border rounded-xl p-4" data-testid={`schedule-job-${b.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-muted-foreground shrink-0" />
                              <span className="font-semibold text-sm truncate">{b.customerName}</span>
                              {b.customerPhone && (
                                <a href={`tel:${b.customerPhone}`} className="text-xs text-muted-foreground hover:text-primary shrink-0">
                                  {b.customerPhone}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock size={11} className="shrink-0" />
                              <span>{b.scheduledTime ?? "Time TBD"}</span>
                              <span className="text-muted-foreground/50">·</span>
                              <span className="capitalize">{b.serviceType?.replace(/_/g, " ")}</span>
                            </div>
                            {b.address && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin size={11} className="shrink-0" />
                                <span className="truncate">{b.address}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0 space-y-1">
                            {/* QW-03: StatusBadge */}
                            <StatusBadge status={b.status ?? "scheduled"} />
                            {b.amount && <p className="text-sm font-semibold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </StaffLayout>
  );
}
