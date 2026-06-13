import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useStaffPerformance } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { StaffPerformanceRow } from "../api";

function StaffTable({ title, rows }: { title: string; rows: StaffPerformanceRow[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet</p>
        ) : (
          <div className="space-y-2">
            {rows.map(s => (
              <div key={s.staffId} className="flex flex-wrap justify-between gap-2 text-sm border-b pb-2 last:border-0">
                <span className="font-medium">{s.staffName}</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{s.assignedVehicles} vehicles</Badge>
                  <span className="text-green-600">{s.completedVisits} done</span>
                  <span className="text-red-600">{s.missedVisits} missed</span>
                  <span>{s.completionPercentage}%</span>
                  <span>Rating {s.customerRating}%</span>
                  {s.customerComplaints > 0 && <span className="text-destructive">{s.customerComplaints} complaints</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DcmsStaffPerformancePage() {
  const { data, isLoading, error } = useStaffPerformance();

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <h2 className="font-display font-bold text-xl">Staff Performance</h2>
        {isLoading ? <Skeleton className="h-64 w-full" /> : error ? (
          <p className="text-destructive">Failed to load performance data</p>
        ) : data ? (
          <div className="grid md:grid-cols-2 gap-4">
            <StaffTable title="Top Performers" rows={data.topPerformers} />
            <StaffTable title="Needs Improvement" rows={data.lowestPerformers} />
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">All Staff Metrics</CardTitle></CardHeader>
              <CardContent>
                {data.staff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                ) : (
                  <div className="space-y-2">
                    {data.staff.map(s => (
                      <div key={s.staffId} className="flex flex-wrap justify-between gap-2 text-sm border-b pb-2">
                        <span className="font-medium">{s.staffName}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.completedVisits} completed · {s.missedVisits} missed · {s.rejectedVisits} rejected · {s.completionPercentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
