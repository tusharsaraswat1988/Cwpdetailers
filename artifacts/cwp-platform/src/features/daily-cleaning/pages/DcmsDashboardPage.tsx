import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useDcmsDashboard } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Clock, PauseCircle, RefreshCw, ThumbsDown, Users } from "lucide-react";

function StatCard({ title, value, icon: Icon, sub }: { title: string; value: number | string; icon: typeof Users; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DcmsDashboardPage() {
  const { data, isLoading, error } = useDcmsDashboard();
  const ops = data?.renewalOps;
  const feedback = data?.feedback;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="text-destructive">Failed to load dashboard</p>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Active Subscriptions" value={data.activeSubscriptions} icon={Users} />
              <StatCard title="Pending Visits" value={data.pendingVisits} icon={Clock} />
              <StatCard title="Completed Visits" value={data.completedVisits} icon={CheckCircle} />
              <StatCard title="Missed Visits" value={data.missedVisits} icon={AlertTriangle} />
              <StatCard title="Renewal Eligible" value={ops?.renewalEligible ?? data.renewalsDue} icon={RefreshCw} />
              <StatCard title="Renewal Due Soon" value={ops?.renewalDueSoon ?? 0} icon={RefreshCw} sub="≤3 cleanings left" />
              <StatCard title="Paused" value={ops?.pausedSubscriptions ?? 0} icon={PauseCircle} />
              <StatCard title="Inactive" value={ops?.inactiveSubscriptions ?? 0} icon={Users} />
              <StatCard title="Outstanding Washes" value={ops?.outstandingWashes ?? 0} icon={Clock} />
              <StatCard title="Pending Pause Requests" value={ops?.pendingPauseRequests ?? 0} icon={PauseCircle} />
              <StatCard title="Negative Feedback" value={feedback?.negativeFeedbackCount ?? 0} icon={ThumbsDown} sub="Last 30 days" />
              <StatCard title="Feedback Rate" value={`${feedback?.feedbackRate ?? 0}%`} icon={CheckCircle} sub={`${feedback?.pendingFeedback ?? 0} pending today`} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Outstanding Visits</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">{ops?.outstandingVisits ?? data.outstandingCount ?? 0}</p>
                  {(data.outstandingSubscriptions ?? []).map((s, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-t first:border-0">
                      <span>{s.customerName} · {s.vehicleNumber}</span>
                      <span className="text-amber-600">{s.pendingCleanings} pending</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Top Performers</CardTitle></CardHeader>
                <CardContent>
                  {(data.staffPerformance?.topPerformers ?? []).slice(0, 5).map(s => (
                    <div key={s.staffId} className="flex justify-between text-sm py-1 border-t first:border-0">
                      <span>{s.staffName}</span>
                      <span>{s.completionPercentage}% · {s.completedVisits} visits</span>
                    </div>
                  ))}
                  {(data.staffPerformance?.topPerformers ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No performance data yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Fraud &amp; Compliance</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Rejected Uploads</span><span className="font-semibold text-destructive">{data.fraud.rejectedUploads}</span></div>
                  <div className="flex justify-between"><span>Outside Radius</span><span className="font-semibold text-destructive">{data.fraud.outsideRadiusAttempts}</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Lowest Performers</CardTitle></CardHeader>
                <CardContent>
                  {(data.staffPerformance?.lowestPerformers ?? []).slice(0, 5).map(s => (
                    <div key={s.staffId} className="flex justify-between text-sm py-1 border-t first:border-0">
                      <span>{s.staffName}</span>
                      <span className="text-destructive">{s.completionPercentage}% · {s.customerComplaints} complaints</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
