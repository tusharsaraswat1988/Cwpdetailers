import { useState } from "react";
import { useListBookings, getListBookingsQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import { resolveMediaUrl } from "@/lib/media-url";
import { mapsViewUrl } from "@/lib/maps";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar, Star, Image, ExternalLink, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
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

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function CustomerHistory() {
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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

  // QW-18: Group by month
  const grouped = allBookings.reduce<Record<string, typeof allBookings>>((acc, b) => {
    const key = b.scheduledDate ? monthLabel(b.scheduledDate) : "Unknown date";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});
  const monthKeys = Object.keys(grouped);

  const photoUrls = (b: (typeof allBookings)[number]) => {
    const urls: string[] = [];
    if (b.beforePhotoUrl) urls.push(b.beforePhotoUrl);
    if (b.afterPhotoUrl) urls.push(b.afterPhotoUrl);
    ((b.proofPhotoUrls as string[] | null) ?? []).forEach(u => urls.push(u));
    return urls;
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
        <CustomerPage>
          <CustomerHeader
            title="Service History"
            subtitle={isLoading ? undefined : `${data?.total ?? 0} service${(data?.total ?? 0) !== 1 ? "s" : ""} used`}
          />

          {isError ? (
            <CustomerErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <CustomerSkeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : monthKeys.length === 0 ? (
            <CustomerEmptyState
              icon={<Calendar size={20} />}
              title="No services yet"
              description="Your completed services will appear here"
              action={
                <CustomerButton href={CUSTOMER_ROUTES.schedule} size="sm">
                  Schedule a Service
                </CustomerButton>
              }
            />
          ) : (
            <div className="space-y-6">
              {monthKeys.map(month => (
                <div key={month}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">{month}</p>
                    <div className="flex-1 h-px bg-border" />
                    <p className="text-xs text-muted-foreground">{grouped[month].length} service{grouped[month].length !== 1 ? "s" : ""}</p>
                  </div>

                  <div className="space-y-3">
                    {grouped[month].map(b => {
                      const photos = photoUrls(b);
                      return (
                        <div
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(CUSTOMER_ROUTES.scheduledServiceDetail(b.id))}
                          onKeyDown={e => { if (e.key === "Enter") navigate(CUSTOMER_ROUTES.scheduledServiceDetail(b.id)); }}
                          data-testid={`history-booking-${b.id}`}
                        >
                          <CustomerCard className="customer-transition hover:border-primary/40 cursor-pointer">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="customer-icon-well flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5">
                                  <Calendar size={14} className="text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{b.serviceName ?? b.serviceType?.replace(/_/g, " ")}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {b.scheduledDate}{b.scheduledTime ? ` at ${b.scheduledTime}` : ""}
                                  </p>
                                  {b.staffName && <p className="text-xs text-muted-foreground">by {b.staffName}</p>}
                                  {b.address && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{b.address}</p>
                                  )}
                                  {(b.locationLat != null && b.locationLng != null) && (
                                    <a
                                      href={mapsViewUrl(b.locationLat, b.locationLng)}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                                    >
                                      <ExternalLink size={10} /> View location
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0 flex items-start gap-1.5">
                                <div>
                                  <CustomerStatusBadge status={b.status ?? "scheduled"} />
                                  {b.amount && <p className="text-sm font-semibold mt-1">₹{Number(b.amount).toLocaleString("en-IN")}</p>}
                                  {b.rating && (
                                    <div className="flex items-center justify-end gap-0.5 mt-1">
                                      {Array.from({ length: b.rating }).map((_, i) => (
                                        <Star key={i} size={10} fill="currentColor" className="text-primary" />
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <ChevronRight size={16} className="text-muted-foreground/50 mt-1 shrink-0" />
                              </div>
                            </div>

                            {photos.length > 0 && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                                <Image size={12} className="text-muted-foreground shrink-0" />
                                <div className="flex items-center gap-2 flex-wrap">
                                  {b.beforePhotoUrl && (
                                    <button onClick={e => { e.stopPropagation(); setLightboxUrl(resolveMediaUrl(b.beforePhotoUrl!)); }} className="text-center group">
                                      <img src={resolveMediaUrl(b.beforePhotoUrl)} alt="Before"
                                        className="w-20 h-20 rounded-lg object-cover border border-border group-hover:opacity-80 transition-opacity cursor-pointer" />
                                      <p className="text-[9px] text-muted-foreground mt-0.5">Before</p>
                                    </button>
                                  )}
                                  {b.afterPhotoUrl && (
                                    <button onClick={e => { e.stopPropagation(); setLightboxUrl(resolveMediaUrl(b.afterPhotoUrl!)); }} className="text-center group">
                                      <img src={resolveMediaUrl(b.afterPhotoUrl)} alt="After"
                                        className="w-20 h-20 rounded-lg object-cover border border-border group-hover:opacity-80 transition-opacity cursor-pointer" />
                                      <p className="text-[9px] text-muted-foreground mt-0.5">After</p>
                                    </button>
                                  )}
                                  {((b.proofPhotoUrls as string[] | null) ?? []).slice(0, 2).map((url: string, idx: number) => (
                                    <button key={idx} onClick={e => { e.stopPropagation(); setLightboxUrl(resolveMediaUrl(url)); }} className="group">
                                      <img src={resolveMediaUrl(url)} alt=""
                                        className="w-20 h-20 rounded-lg object-cover border border-border group-hover:opacity-80 transition-opacity cursor-pointer" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CustomerCard>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
            <DialogContent className="max-w-2xl p-2 bg-black border-0">
              {lightboxUrl && (
                <img src={lightboxUrl} alt="Service photo" className="w-full h-auto rounded-lg max-h-[80vh] object-contain" />
              )}
            </DialogContent>
          </Dialog>
        </CustomerPage>
      )}
    </CustomerLayout>
  );
}
