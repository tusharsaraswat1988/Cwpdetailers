import { useState } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useCustomerDcmsVisits } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { resolveMediaUrl } from "@/lib/media-url";
import { format } from "date-fns";
import { Link } from "wouter";
import { ExternalLink, CalendarClock } from "lucide-react";
import { mapsViewUrl } from "@/lib/maps";

export default function CustomerDcmsHistoryPage() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const { data: visits, isLoading } = useCustomerDcmsVisits({ month: Number(month), year: Number(year) });

  return (
    <CustomerLayout>
      <div className="space-y-4">
        <Link href="/customer/daily-cleaning" className="text-sm text-primary">← Daily Cleaning</Link>
        <h1 className="font-display font-bold text-xl">Visit History</h1>

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
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {visits?.map(row => (
              <Card key={row.visit.id}>
                <CardContent className="p-4 flex gap-3">
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
                </CardContent>
              </Card>
            ))}
            {visits?.length === 0 && (
              <EmptyState
                icon={<CalendarClock size={20} />}
                title="No visits for this period"
                description="Try a different month or year above"
              />
            )}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
