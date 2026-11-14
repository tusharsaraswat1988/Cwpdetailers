import { useState, useMemo } from "react";
import { useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import { resolveMediaUrl } from "@/lib/media-url";
import { mapsViewUrl } from "@/lib/maps";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Calendar,
  Star,
  Image,
  ExternalLink,
  ChevronRight,
  Clock,
  Car,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerErrorState,
  CustomerSkeleton,
  CustomerButton,
  CustomerStatusBadge,
  CustomerCard,
} from "@/features/customer-ds";
import { cn } from "@/lib/utils";

type HistoryTab = "upcoming" | "completed" | "cancelled";

const STATUS_FRIENDLY_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  waiting_assignment: "Finding Technician",
  assigned: "Technician Assigned",
  en_route: "Technician En Route",
  in_progress: "Service In Progress",
  completed: "Completed",
  missed: "Missed Visit",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

export default function CustomerHistory() {
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HistoryTab>("upcoming");
  const [, navigate] = useLocation();

  const { data, isLoading, isError, refetch } = useListBookings(
    { customerId: String(customerId ?? "") } as any,
    {
      query: {
        queryKey: getListBookingsQueryKey({ customerId: String(customerId ?? "") } as any),
        enabled: customerId != null,
      },
    },
  );

  const allBookings = data?.data ?? [];

  // Categorize bookings into Upcoming, Completed, and Cancelled
  const { upcomingBookings, completedBookings, cancelledBookings } = useMemo(() => {
    const upcoming: typeof allBookings = [];
    const completed: typeof allBookings = [];
    const cancelled: typeof allBookings = [];

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    for (const b of allBookings) {
      const status = (b.status || "").toLowerCase();
      if (status === "cancelled") {
        cancelled.push(b);
      } else if (status === "completed") {
        completed.push(b);
      } else {
        // Scheduled, confirmed, waiting, assigned, in_progress, etc.
        upcoming.push(b);
      }
    }

    // Sort upcoming soonest first; completed & cancelled newest first
    upcoming.sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
    completed.sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));
    cancelled.sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));

    return { upcomingBookings: upcoming, completedBookings: completed, cancelledBookings: cancelled };
  }, [allBookings]);

  const currentList =
    activeTab === "upcoming"
      ? upcomingBookings
      : activeTab === "completed"
      ? completedBookings
      : cancelledBookings;

  const photoUrls = (b: (typeof allBookings)[number]) => {
    const urls: string[] = [];
    if (b.beforePhotoUrl) urls.push(b.beforePhotoUrl);
    if (b.afterPhotoUrl) urls.push(b.afterPhotoUrl);
    ((b.proofPhotoUrls as string[] | null) ?? []).forEach((u) => urls.push(u));
    return urls;
  };

  const handleBookAgain = (e: React.MouseEvent, b: (typeof allBookings)[number]) => {
    e.stopPropagation();
    const serviceParam = b.serviceType ? `service=${encodeURIComponent(b.serviceType)}` : "";
    const vehicleParam = b.vehicleId ? `&vehicleId=${b.vehicleId}` : "";
    navigate(`/customer/schedule?${serviceParam}${vehicleParam}`);
  };

  return (
    <CustomerLayout>
      {scopeLoading ? (
        <CustomerPage>
          <CustomerSkeleton className="h-8 w-48" />
          <CustomerSkeleton className="h-24" />
          <CustomerSkeleton className="h-24" />
        </CustomerPage>
      ) : missingCustomerLink || customerId == null ? (
        <CustomerPage>
          <CustomerEmptyState
            title="Account not linked"
            description="Your login is not linked to a customer profile yet."
            action={<NoCustomerProfileMessage />}
            hint=""
          />
        </CustomerPage>
      ) : (
        <CustomerPage className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CustomerHeader
              title="My Bookings & History"
              subtitle={isLoading ? undefined : `${allBookings.length} total booking${allBookings.length !== 1 ? "s" : ""}`}
            />
            <Link href={CUSTOMER_ROUTES.schedule}>
              <CustomerButton variant="primary" size="sm" className="gap-1.5 self-start sm:self-auto shadow-xs">
                Book Service <ArrowRight size={14} />
              </CustomerButton>
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
                activeTab === "upcoming"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
              )}
            >
              <Clock size={14} />
              Upcoming
              {upcomingBookings.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px]">
                  {upcomingBookings.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
                activeTab === "completed"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
              )}
            >
              <CheckCircle2 size={14} />
              Completed
              {completedBookings.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px]">
                  {completedBookings.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("cancelled")}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2",
                activeTab === "cancelled"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
              )}
            >
              <XCircle size={14} />
              Cancelled
              {cancelledBookings.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px]">
                  {cancelledBookings.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          {isError ? (
            <CustomerErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CustomerSkeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : currentList.length === 0 ? (
            <CustomerEmptyState
              icon={<Calendar size={22} />}
              title={
                activeTab === "upcoming"
                  ? "No upcoming bookings"
                  : activeTab === "completed"
                  ? "No completed services yet"
                  : "No cancelled bookings"
              }
              description={
                activeTab === "upcoming"
                  ? "Your scheduled doorstep wash and detailing visits will appear here."
                  : activeTab === "completed"
                  ? "Services completed with before/after photos and reports will appear here."
                  : "You have no cancelled service appointments."
              }
              action={
                activeTab !== "cancelled" ? (
                  <CustomerButton href={CUSTOMER_ROUTES.schedule} size="sm">
                    Schedule a Service
                  </CustomerButton>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3.5">
              {currentList.map((b) => {
                const photos = photoUrls(b);
                const friendlyStatus = STATUS_FRIENDLY_LABELS[b.status || ""] || b.status;
                const isCompleted = b.status === "completed";

                return (
                  <CustomerCard
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(CUSTOMER_ROUTES.scheduledServiceDetail(b.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(CUSTOMER_ROUTES.scheduledServiceDetail(b.id));
                    }}
                    className="p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer relative bg-white group"
                    data-testid={`history-booking-${b.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-blue-100/60">
                          <Car size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-primary">#{b.id}</span>
                            <span className="text-xs text-slate-300">•</span>
                            <p className="font-display font-bold text-sm text-foreground truncate">
                              {b.serviceName ?? b.serviceType?.replace(/_/g, " ")}
                            </p>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">
                              {b.scheduledDate}
                              {b.scheduledTime ? ` · ${b.scheduledTime}` : ""}
                            </span>
                            {b.staffName && (
                              <span className="text-muted-foreground">· Tech: {b.staffName}</span>
                            )}
                          </p>

                          {b.address && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-sm">
                              {b.address}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <CustomerStatusBadge status={b.status ?? "scheduled"} />
                        {b.amount && (
                          <p className="font-display font-bold text-sm text-foreground">
                            ₹{Number(b.amount).toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Photo previews if available */}
                    {photos.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <Image size={13} className="text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-2 flex-wrap">
                          {b.beforePhotoUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxUrl(resolveMediaUrl(b.beforePhotoUrl!));
                              }}
                              className="text-center group/img"
                            >
                              <img
                                src={resolveMediaUrl(b.beforePhotoUrl)}
                                alt="Before"
                                className="w-14 h-14 rounded-lg object-cover border border-slate-200 group-hover/img:opacity-80 transition-opacity"
                              />
                              <p className="text-[9px] text-muted-foreground mt-0.5">Before</p>
                            </button>
                          )}
                          {b.afterPhotoUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxUrl(resolveMediaUrl(b.afterPhotoUrl!));
                              }}
                              className="text-center group/img"
                            >
                              <img
                                src={resolveMediaUrl(b.afterPhotoUrl)}
                                alt="After"
                                className="w-14 h-14 rounded-lg object-cover border border-slate-200 group-hover/img:opacity-80 transition-opacity"
                              />
                              <p className="text-[9px] text-muted-foreground mt-0.5">After</p>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-semibold text-primary flex items-center gap-1 group-hover:underline">
                        View Details & Tracking <ChevronRight size={13} />
                      </span>

                      {/* Contextual "Book Again" Button on Completed Bookings */}
                      {isCompleted && (
                        <button
                          type="button"
                          onClick={(e) => handleBookAgain(e, b)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-primary hover:bg-blue-100 text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                          data-testid={`book-again-${b.id}`}
                        >
                          <RotateCcw size={12} /> Book Again
                        </button>
                      )}
                    </div>
                  </CustomerCard>
                );
              })}
            </div>
          )}

          {/* Photo Lightbox */}
          <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
            <DialogContent className="max-w-2xl p-2 bg-black border-0">
              {lightboxUrl && (
                <img
                  src={lightboxUrl}
                  alt="Service photo"
                  className="w-full h-auto rounded-lg max-h-[80vh] object-contain"
                />
              )}
            </DialogContent>
          </Dialog>
        </CustomerPage>
      )}
    </CustomerLayout>
  );
}
