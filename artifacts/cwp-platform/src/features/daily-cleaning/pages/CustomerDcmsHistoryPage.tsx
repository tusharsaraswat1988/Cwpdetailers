import { useState } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useCustomerDcmsVisits } from "../api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveMediaUrl } from "@/lib/media-url";
import { format } from "date-fns";
import { ExternalLink, CalendarClock } from "lucide-react";
import { mapsViewUrl } from "@/lib/maps";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerSkeleton,
  CustomerButton,
  CustomerCard,
  CustomerPhotoReport,
} from "@/features/customer-ds";

export default function CustomerDcmsHistoryPage() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const { data: visits, isLoading } = useCustomerDcmsVisits({ month: Number(month), year: Number(year) });

  return (
    <CustomerLayout>
      <CustomerPage>
        <CustomerButton href="/customer/daily-cleaning" variant="ghost" size="sm" className="h-auto px-0 text-primary">
          ← Daily Cleaning
        </CustomerButton>
        <CustomerHeader title="Visit History" />

        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{format(new Date(2000, i), "MMM")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear(), now.getFullYear() - 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <CustomerSkeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {visits?.map(row => {
              const visit = row.visit as typeof row.visit & {
                beforePhotoUrl?: string | null;
                afterPhotoUrl?: string | null;
              };
              const beforeUrl = visit.beforePhotoUrl
                ? resolveMediaUrl(visit.beforePhotoUrl)
                : null;
              const afterUrl = visit.afterPhotoUrl
                ? resolveMediaUrl(visit.afterPhotoUrl)
                : null;

              if (beforeUrl || afterUrl) {
                return (
                  <CustomerPhotoReport
                    key={row.visit.id}
                    title={`${row.vehicleNumber} · ${row.visit.visitType}`}
                    status={row.visit.status}
                    beforeUrl={beforeUrl}
                    afterUrl={afterUrl ?? (visit.photoUrl ? resolveMediaUrl(visit.photoUrl) : null)}
                    completedAt={format(new Date(row.visit.visitTime), "dd MMM yyyy, hh:mm a")}
                    timeline={
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Staff: {row.staffName}</p>
                        {row.visit.latitude != null && row.visit.longitude != null && (
                          <a
                            href={mapsViewUrl(row.visit.latitude, row.visit.longitude)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink size={11} /> Location verified · View on map
                          </a>
                        )}
                      </div>
                    }
                  />
                );
              }

              return (
                <CustomerCard key={row.visit.id}>
                  <div className="flex gap-3">
                    {row.visit.photoUrl && (
                      <img src={resolveMediaUrl(row.visit.photoUrl)} alt="Proof" className="w-16 h-16 rounded object-cover" />
                    )}
                    <div>
                      <p className="font-medium">{format(new Date(row.visit.visitTime), "dd MMM yyyy, hh:mm a")}</p>
                      <p className="text-sm text-muted-foreground">Staff: {row.staffName}</p>
                      <p className="text-xs text-muted-foreground">{row.visit.visitType} · {row.vehicleNumber}</p>
                      {row.visit.latitude != null && row.visit.longitude != null && (
                        <a
                          href={mapsViewUrl(row.visit.latitude, row.visit.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                        >
                          <ExternalLink size={11} /> Location verified · View on map
                        </a>
                      )}
                    </div>
                  </div>
                </CustomerCard>
              );
            })}
            {visits?.length === 0 && (
              <CustomerEmptyState
                icon={<CalendarClock size={20} />}
                title="No visits for this period"
                description="Try a different month or year above"
              />
            )}
          </div>
        )}
      </CustomerPage>
    </CustomerLayout>
  );
}
