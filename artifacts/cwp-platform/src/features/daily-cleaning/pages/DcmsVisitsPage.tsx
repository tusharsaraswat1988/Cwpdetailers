import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useDcmsVisits } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/lib/media-url";
import { format } from "date-fns";

export default function DcmsVisitsPage() {
  const { data: visits, isLoading } = useDcmsVisits();

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <h2 className="font-display font-bold text-xl">Visit History</h2>
        <p className="text-sm text-muted-foreground">Completed visits are immutable audit records.</p>

        {isLoading ? <p>Loading...</p> : (
          <div className="space-y-3">
            {visits?.map(row => (
              <Card key={row.visit.id}>
                <CardContent className="p-4 flex gap-4">
                  {row.visit.photoUrl && (
                    <img
                      src={resolveMediaUrl(row.visit.photoUrl)}
                      alt="Visit proof"
                      className="w-20 h-20 object-cover rounded-lg shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{row.vehicleNumber}</span>
                      <Badge variant={row.visit.status === "completed" ? "default" : "destructive"}>{row.visit.status}</Badge>
                      <Badge variant="outline">{row.visit.visitType}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{row.customerName} · {row.staffName}</p>
                    <p className="text-sm">{format(new Date(row.visit.visitTime), "dd MMM yyyy, hh:mm a")}</p>
                    {row.visit.latitude != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        GPS: {row.visit.latitude.toFixed(5)}, {row.visit.longitude?.toFixed(5)}
                      </p>
                    )}
                    {row.visit.rejectionReason && (
                      <p className="text-xs text-destructive mt-1">{row.visit.rejectionReason}</p>
                    )}
                    {(row.visit.ocrText || row.visit.confirmedRegistration) && (
                      <div className="text-xs mt-2 p-2 rounded bg-muted/60 space-y-0.5">
                        {row.visit.ocrText && (
                          <p>
                            <span className="text-muted-foreground">Detected:</span>{" "}
                            {row.visit.ocrText.trim().slice(0, 80)}
                            {row.visit.ocrConfidence != null && (
                              <span className="text-muted-foreground"> ({Math.round(row.visit.ocrConfidence)}%)</span>
                            )}
                          </p>
                        )}
                        {row.visit.confirmedRegistration && (
                          <p>
                            <span className="text-muted-foreground">Confirmed:</span>{" "}
                            <span className="font-medium">{row.visit.confirmedRegistration}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {visits?.length === 0 && <p className="text-muted-foreground">No visits recorded yet</p>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
