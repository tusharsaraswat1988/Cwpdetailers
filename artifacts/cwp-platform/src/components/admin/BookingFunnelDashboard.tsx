import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingDown,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Sparkles,
  Tag,
  Gift,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStage {
  step: number;
  milestone: string;
  name: string;
  totalEvents: number;
  uniqueSessions: number;
  dropoffPercent: number;
  stepConversionPercent: number;
}

interface CityBreakdown {
  cityName: string;
  views: number;
  confirmed: number;
  conversionRate: number;
}

interface FunnelReport {
  summary: {
    totalTopFunnelSessions: number;
    totalConfirmedBookings: number;
    overallConversionRate: number;
    couponAppliedCount: number;
    loyaltyRedeemedCount: number;
    paymentFailedCount: number;
    cancelledCount: number;
  };
  stages: FunnelStage[];
  cityBreakdown: CityBreakdown[];
}

export function BookingFunnelDashboard({ cityId }: { cityId?: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<FunnelReport>({
    queryKey: ["admin-booking-funnel", cityId || "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cityId && cityId !== "all") params.set("cityId", cityId);
      const res = await fetch(`/api/marketing/funnel/analytics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch funnel analytics");
      return res.json();
    },
    staleTime: 30000,
  });

  const summary = data?.summary || {
    totalTopFunnelSessions: 0,
    totalConfirmedBookings: 0,
    overallConversionRate: 0,
    couponAppliedCount: 0,
    loyaltyRedeemedCount: 0,
    paymentFailedCount: 0,
    cancelledCount: 0,
  };

  const stages = data?.stages || [];
  const cityBreakdown = data?.cityBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Top Controls & KPI Row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base text-foreground">
            Customer Booking Conversion Funnel
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time step-by-step telemetry measuring drop-off across discovery, vehicle selection, slots, and checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-muted-foreground hover:text-foreground flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <RefreshCw size={13} className={cn(isFetching && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 shadow-2xs border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Top-Funnel Sessions
            </span>
            <Users size={16} className="text-blue-500" />
          </div>
          <p className="font-display font-extrabold text-2xl text-foreground mt-2">
            {summary.totalTopFunnelSessions.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">Unique visitors viewing services</span>
        </Card>

        <Card className="p-4 shadow-2xs border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Confirmed Bookings
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="font-display font-extrabold text-2xl text-emerald-600 mt-2">
            {summary.totalConfirmedBookings.toLocaleString()}
          </p>
          <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
            {summary.overallConversionRate}% overall conversion
          </span>
        </Card>

        <Card className="p-4 shadow-2xs border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Discounts Applied
            </span>
            <Tag size={16} className="text-purple-500" />
          </div>
          <p className="font-display font-extrabold text-2xl text-purple-600 mt-2">
            {(summary.couponAppliedCount + summary.loyaltyRedeemedCount).toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {summary.couponAppliedCount} coupons · {summary.loyaltyRedeemedCount} loyalty redemptions
          </span>
        </Card>

        <Card className="p-4 shadow-2xs border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Payment Failures
            </span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="font-display font-extrabold text-2xl text-amber-600 mt-2">
            {summary.paymentFailedCount.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {summary.cancelledCount} user cancellations
          </span>
        </Card>
      </div>

      {/* Funnel Visualizer */}
      <Card className="p-5 shadow-2xs border-slate-200">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Milestone Drop-Off Pipeline</span>
            <Badge variant="outline" className="text-xs">
              8 Core Steps
            </Badge>
          </CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading funnel metrics...</div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage, idx) => {
              const maxSessions = stages[0]?.uniqueSessions || 1;
              const fillWidth = Math.max(8, Math.round((stage.uniqueSessions / maxSessions) * 100));

              return (
                <div key={stage.milestone} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-foreground flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                        {stage.step}
                      </span>
                      {stage.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {stage.uniqueSessions.toLocaleString()} sessions
                      </span>
                      {idx > 0 && stage.dropoffPercent > 0 && (
                        <span className="text-red-500 text-[11px] font-medium flex items-center gap-0.5">
                          <TrendingDown size={11} /> -{stage.dropoffPercent}% drop
                        </span>
                      )}
                      {idx > 0 && stage.dropoffPercent === 0 && (
                        <span className="text-emerald-600 text-[11px] font-medium flex items-center gap-0.5">
                          100% retention
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="h-6 w-full bg-slate-100 rounded-lg overflow-hidden relative">
                    <div
                      className={cn(
                        "h-full rounded-lg transition-all duration-500 flex items-center px-2 text-[10px] font-bold text-white",
                        idx === 0
                          ? "bg-blue-600"
                          : idx === stages.length - 1
                          ? "bg-emerald-600"
                          : "bg-primary/80"
                      )}
                      style={{ width: `${fillWidth}%` }}
                    >
                      {stage.stepConversionPercent}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* City Breakdown Table */}
      {cityBreakdown.length > 0 && (
        <Card className="p-5 shadow-2xs border-slate-200">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-bold">City-Wise Conversion Performance</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-muted-foreground font-semibold">
                  <th className="py-2">City</th>
                  <th className="py-2 text-right">Service Views</th>
                  <th className="py-2 text-right">Confirmed Bookings</th>
                  <th className="py-2 text-right">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cityBreakdown.map((c) => (
                  <tr key={c.cityName} className="hover:bg-slate-50">
                    <td className="py-2.5 font-bold text-foreground">{c.cityName}</td>
                    <td className="py-2.5 text-right font-mono">{c.views.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono text-emerald-600 font-semibold">
                      {c.confirmed.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-bold text-primary">
                      {c.conversionRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
