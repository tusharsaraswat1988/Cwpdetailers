import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import { useAuth } from "@/lib/auth";
import { useListBookings, useListStaff } from "@workspace/api-client-react";
import { Calendar, UserCog, CheckCircle, Clock, AlertCircle, TrendingUp, Funnel, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

async function fetchLeadStats(): Promise<{ total: number; converted: number; conversionRate: number }> {
  const res = await fetch("/api/leads/stats");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function fetchFollowUps(): Promise<any[]> {
  const res = await fetch("/api/leads/follow-ups");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function FranchiseeDashboard() {
  const { user } = useAuth();
  const branchId = user?.branchId ?? undefined;

  const { data: pendingResp } = useListBookings({ branchId, status: "pending" });
  const { data: allResp } = useListBookings({ branchId });
  const { data: staff = [] } = useListStaff({ branchId });
  const bookings = pendingResp?.data ?? [];
  const allBookings = allResp?.data ?? [];
  const { data: leadStats } = useQuery({ queryKey: ["franchisee-leadStats"], queryFn: fetchLeadStats });
  const { data: followUps } = useQuery({ queryKey: ["franchisee-leadFollowUps"], queryFn: fetchFollowUps });

  const pendingApprovals = bookings.length;
  const todayJobs = allBookings.filter(b => {
    const today = new Date().toISOString().slice(0, 10);
    return b.scheduledDate === today && (b.status === "confirmed" || b.status === "in_progress");
  }).length;
  const completedToday = allBookings.filter(b => {
    const today = new Date().toISOString().slice(0, 10);
    return b.scheduledDate === today && b.status === "completed";
  }).length;
  const pendingStaff = staff.filter(s => s.verificationStatus === "pending").length;

  const kpis = [
    { label: "Pending Booking Requests", value: pendingApprovals, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Today's Active Jobs", value: todayJobs, icon: Calendar, color: "text-primary", bg: "bg-primary/10" },
    { label: "Completed Today", value: completedToday, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Staff Pending Verification", value: pendingStaff, icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10" },
  ];

  return (
    <FranchiseeLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">Your city operations overview</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className={`font-display font-bold text-2xl ${color}`}>{value}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Pending booking requests */}
        <div className="bg-card border border-border rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <h2 className="font-semibold text-sm">Pending Booking Requests</h2>
            {pendingApprovals > 0 && (
              <span className="ml-auto text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-medium">
                {pendingApprovals} waiting
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {bookings.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No pending requests</div>
            ) : (
              bookings.slice(0, 8).map((b: any) => (
                <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.customerName || `Customer #${b.customerId}`}</p>
                    <p className="text-xs text-muted-foreground">{b.serviceName || "Service"} · {b.scheduledDate}</p>
                  </div>
                  <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">Pending</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lead stats + follow-ups */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Funnel size={16} className="text-amber-500" />
                <h2 className="font-semibold text-sm">Leads Overview</h2>
              </div>
              <Link href="/franchisee/leads" className="text-xs text-amber-500 hover:underline flex items-center gap-1">
                View pipeline <ArrowRight size={10} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{leadStats?.total ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Total Leads</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{leadStats?.converted ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Converted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{leadStats?.conversionRate ?? 0}%</p>
                <p className="text-[10px] text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-500" />
                <h2 className="font-semibold text-sm">Follow-ups</h2>
              </div>
              <Link href="/franchisee/leads" className="text-xs text-amber-500 hover:underline">View</Link>
            </div>
            <div className="space-y-2">
              {(followUps ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No upcoming follow-ups</p>
              ) : (
                (followUps ?? []).slice(0, 4).map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.phone}</p>
                    </div>
                    <span className="text-xs text-amber-500">
                      {l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString("en-IN") : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Today's jobs */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Calendar size={16} className="text-primary" />
            <h2 className="font-semibold text-sm">Today's Jobs</h2>
          </div>
          <div className="divide-y divide-border">
            {allBookings.filter(b => b.scheduledDate === new Date().toISOString().slice(0, 10)).length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No jobs scheduled today</div>
            ) : (
              allBookings
                .filter(b => b.scheduledDate === new Date().toISOString().slice(0, 10))
                .slice(0, 10)
                .map((b: any) => (
                  <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.customerName || `Customer #${b.customerId}`}</p>
                      <p className="text-xs text-muted-foreground">{b.serviceName || "Service"} · {b.scheduledTime || "—"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      b.status === "completed" ? "bg-green-500/10 text-green-500" :
                      b.status === "in_progress" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>{b.status}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </FranchiseeLayout>
  );
}
