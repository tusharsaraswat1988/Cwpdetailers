import { useGetStaffPerformance, getGetStaffPerformanceQueryKey, useGetStaffLeaderboard, getGetStaffLeaderboardQueryKey } from "@workspace/api-client-react";
import StaffLayout from "@/components/layout/StaffLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Star, TrendingUp, Calendar } from "lucide-react";

export default function StaffPerformance() {
  const staffId = 1;
  const month = new Date().toISOString().slice(0, 7);

  const { data: perf, isLoading } = useGetStaffPerformance(staffId, { month }, {
    query: { queryKey: getGetStaffPerformanceQueryKey(staffId, { month }) }
  });
  const { data: leaderboard } = useGetStaffLeaderboard({ month }, {
    query: { queryKey: getGetStaffLeaderboardQueryKey({ month }) }
  });

  const myRank = (leaderboard ?? []).findIndex(s => s.staffId === staffId) + 1;

  return (
    <StaffLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">My Performance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{month}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Jobs Completed", value: perf?.jobsCompleted, icon: Calendar, suffix: "" },
            { label: "Revenue Generated", value: perf?.revenueGenerated, icon: TrendingUp, prefix: "₹", toLocale: true },
            { label: "Average Rating", value: perf?.averageRating, icon: Star, suffix: "/5", toFixed: 1 },
            { label: "Attendance Days", value: perf?.attendanceDays, icon: Calendar, suffix: " days" },
          ].map(({ label, value, icon: Icon, prefix, suffix, toLocale, toFixed }) => (
            <Card key={label} data-testid={`perf-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={15} className="text-primary" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                {isLoading ? <Skeleton className="h-7 w-20" /> : (
                  <p className="font-display font-bold text-2xl text-primary">
                    {prefix}{toLocale ? Number(value ?? 0).toLocaleString("en-IN") : toFixed ? Number(value ?? 0).toFixed(1) : value ?? 0}{suffix}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {myRank > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold">Your Leaderboard Rank</p>
              <p className="text-2xl font-display font-bold text-primary">#{myRank}</p>
              <p className="text-xs text-muted-foreground">Efficiency score: {perf?.efficiencyScore?.toFixed(1)}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy size={14} className="text-primary" />Team Leaderboard</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(leaderboard ?? []).slice(0, 5).map(s => (
              <div key={s.staffId} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${s.staffId === staffId ? "bg-primary/5 border border-primary/20" : ""}`}
                data-testid={`leaderboard-entry-${s.staffId}`}>
                <span className="w-6 font-bold text-sm text-center text-primary">#{s.rank}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.staffName} {s.staffId === staffId && "(You)"}</p>
                  <p className="text-xs text-muted-foreground">{s.jobsCompleted} jobs</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                  <Star size={11} fill="currentColor" />
                  {Number(s.averageRating ?? 0).toFixed(1)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  );
}
