import { useState } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useCustomerDcmsGallery } from "../api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { resolveMediaUrl } from "@/lib/media-url";
import { format } from "date-fns";
import { Link } from "wouter";
import { ImageOff } from "lucide-react";

export default function CustomerDcmsGalleryPage() {
  const now = new Date();
  const [month, setMonth] = useState<string>("all");
  const [year, setYear] = useState(String(now.getFullYear()));
  const filters: Record<string, string | number> = { year: Number(year) };
  if (month !== "all") filters.month = Number(month);
  const { data: photos, isLoading } = useCustomerDcmsGallery(filters);

  return (
    <CustomerLayout>
      <div className="space-y-4">
        <Link href="/customer/daily-cleaning" className="text-sm text-primary">← Daily Cleaning</Link>
        <h1 className="font-display font-bold text-xl">Photo Gallery</h1>

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
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {photos?.map(row => (
              <div key={row.visit.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                {row.visit.photoUrl && (
                  <img
                    src={resolveMediaUrl(row.visit.photoUrl)}
                    alt={`${row.vehicleNumber} ${format(new Date(row.visit.visitTime), "dd MMM")}`}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs p-1.5">
                  {format(new Date(row.visit.visitTime), "dd MMM")} · {row.staffName}
                </div>
              </div>
            ))}
            {photos?.length === 0 && (
              <div className="col-span-2">
                <EmptyState icon={<ImageOff size={20} />} title="No photos yet" description="Visit proof photos will appear here" />
              </div>
            )}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
