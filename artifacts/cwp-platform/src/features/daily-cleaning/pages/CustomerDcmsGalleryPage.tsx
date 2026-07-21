import { useState } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useCustomerDcmsGallery } from "../api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveMediaUrl } from "@/lib/media-url";
import { format } from "date-fns";
import { ImageOff } from "lucide-react";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerSkeleton,
  CustomerButton,
  CustomerPhotoReport,
} from "@/features/customer-ds";

export default function CustomerDcmsGalleryPage() {
  const now = new Date();
  const [month, setMonth] = useState<string>("all");
  const [year, setYear] = useState(String(now.getFullYear()));
  const filters: Record<string, string | number> = { year: Number(year) };
  if (month !== "all") filters.month = Number(month);
  const { data: photos, isLoading } = useCustomerDcmsGallery(filters);

  return (
    <CustomerLayout>
      <CustomerPage>
        <CustomerButton href="/customer/daily-cleaning" variant="ghost" size="sm" className="h-auto px-0 text-primary">
          ← Daily Cleaning
        </CustomerButton>
        <CustomerHeader title="Photo Gallery" />

        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
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
            {Array.from({ length: 3 }).map((_, i) => (
              <CustomerSkeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : photos?.length === 0 ? (
          <CustomerEmptyState
            icon={<ImageOff size={20} />}
            title="No photos yet"
            description="Visit proof photos will appear here"
          />
        ) : (
          <div className="space-y-3">
            {photos?.map(row => {
              const visit = row.visit as typeof row.visit & {
                beforePhotoUrl?: string | null;
                afterPhotoUrl?: string | null;
              };
              const beforeUrl = visit.beforePhotoUrl
                ? resolveMediaUrl(visit.beforePhotoUrl)
                : null;
              const afterUrl = visit.afterPhotoUrl
                ? resolveMediaUrl(visit.afterPhotoUrl)
                : visit.photoUrl
                  ? resolveMediaUrl(visit.photoUrl)
                  : null;

              return (
                <CustomerPhotoReport
                  key={row.visit.id}
                  title={row.vehicleNumber}
                  status={row.visit.status ?? "completed"}
                  beforeUrl={beforeUrl}
                  afterUrl={afterUrl}
                  beforeLabel="Before"
                  afterLabel={visit.afterPhotoUrl ? "After" : visit.beforePhotoUrl ? "After" : "Proof"}
                  completedAt={`${format(new Date(row.visit.visitTime), "dd MMM yyyy")} · ${row.staffName}`}
                />
              );
            })}
          </div>
        )}
      </CustomerPage>
    </CustomerLayout>
  );
}
