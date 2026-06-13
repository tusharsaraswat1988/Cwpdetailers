import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useDcmsWashes } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { resolveMediaUrl } from "@/lib/media-url";
import { format } from "date-fns";

export default function DcmsWashHistoryPage() {
  const { data: washes, isLoading } = useDcmsWashes();

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <h2 className="font-display font-bold text-xl">Wash History</h2>
        <p className="text-sm text-muted-foreground">Full wash consumption records with photo proof and location.</p>

        {isLoading ? <p>Loading...</p> : (
          <div className="space-y-3">
            {washes?.map(row => (
              <Card key={row.visit.id}>
                <CardContent className="p-4 flex gap-4">
                  {row.visit.photoUrl && (
                    <img src={resolveMediaUrl(row.visit.photoUrl)} alt="Wash proof" className="w-20 h-20 object-cover rounded-lg" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{row.vehicleNumber} · {row.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(row.visit.visitTime), "dd MMM yyyy, hh:mm a")} · {row.staffName}
                    </p>
                    {row.visit.latitude != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Location: {row.visit.latitude.toFixed(5)}, {row.visit.longitude?.toFixed(5)}
                      </p>
                    )}
                    <p className="text-xs text-green-600 mt-1">Consumption recorded</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {washes?.length === 0 && <p className="text-muted-foreground">No wash records yet</p>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
