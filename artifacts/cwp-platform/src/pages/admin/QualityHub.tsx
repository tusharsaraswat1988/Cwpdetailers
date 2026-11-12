import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Users,
  RefreshCw,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { qualityApi, type SlaPolicy } from "@/lib/quality/api";
import { useAppStore } from "@/lib/store";

export default function QualityHub() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { activeCityId, activeBranchId } = useAppStore();

  const [activeTab, setActiveTab] = useState("overview");
  const [newPolicyOpen, setNewPolicyOpen] = useState(false);

  // SLA Policy Form
  const [policyForm, setPolicyForm] = useState({
    name: "",
    category: "quality",
    priority: "high",
    responseTargetMinutes: 180,
    resolutionTargetMinutes: 720,
    escalationLevel1Minutes: 360,
    escalationLevel2Minutes: 720,
    pauseOnCustomerResponse: true,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["service-quality-analytics", activeCityId, activeBranchId],
    queryFn: () =>
      qualityApi.getQualityAnalytics({
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
      }),
  });

  const { data: supervisorHub, isLoading: hubLoading } = useQuery({
    queryKey: ["supervisor-quality-hub", activeCityId, activeBranchId],
    queryFn: () =>
      qualityApi.getSupervisorHub({
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
      }),
  });

  const { data: slaPolicies, refetch: refetchPolicies } = useQuery({
    queryKey: ["sla-policies-list"],
    queryFn: qualityApi.listSlaPolicies,
  });

  const createPolicyMutation = useMutation({
    mutationFn: () =>
      qualityApi.createSlaPolicy({
        ...policyForm,
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
      }),
    onSuccess: () => {
      setNewPolicyOpen(false);
      refetchPolicies();
      toast({ title: "SLA Policy created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create policy", description: err.message, variant: "destructive" });
    },
  });

  const triggerRemindersMutation = useMutation({
    mutationFn: () =>
      fetch("/api/retention/trigger-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cityId: activeCityId ?? undefined }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      toast({ title: "Renewal Reminders Triggered", description: data.message });
    },
  });

  const op = analytics?.operational;
  const rt = analytics?.ratings;
  const ret = analytics?.retention;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <PageActionHeader
          title="Service Quality & SLA Governance"
          description={`Customer rating: ${rt?.average ?? 5.0}★ · SLA Compliance: ${op?.slaComplianceRate ?? 100}% · Completion Rate: ${op?.completionRate ?? 0}%`}
          primaryAction={{
            label: "Configure SLA Policies",
            onClick: () => setNewPolicyOpen(true),
            testId: "btn-create-sla",
          }}
        />

        {/* 6 Top Metric Highlight Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-muted-foreground">Avg Rating</span>
            <div className="flex items-center gap-1.5 text-xl font-bold">
              <Star size={18} className="fill-amber-400 text-amber-400" />
              <span>{rt?.average ?? 5.0}</span>
              <span className="text-xs font-normal text-muted-foreground">({rt?.totalCount ?? 0})</span>
            </div>
          </div>

          <div className="bg-card border p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-muted-foreground">Completion Rate</span>
            <div className="text-xl font-bold text-green-600">
              {op?.completionRate ?? 0}%
            </div>
            <p className="text-[11px] text-muted-foreground">{op?.completedVisits ?? 0} of {op?.totalVisits ?? 0} cleans</p>
          </div>

          <div className="bg-card border p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-muted-foreground">SLA Compliance</span>
            <div className="text-xl font-bold text-primary">
              {op?.slaComplianceRate ?? 100}%
            </div>
            <p className="text-[11px] text-muted-foreground">Avg resolve: {op?.avgResolutionHours ?? 0}h</p>
          </div>

          <div className="bg-card border p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-muted-foreground">CNA Rate</span>
            <div className="text-xl font-bold text-amber-600">
              {op?.cnaRate ?? 0}%
            </div>
            <p className="text-[11px] text-muted-foreground">{op?.cnaVisits ?? 0} vehicle unavailable</p>
          </div>

          <div className="bg-card border p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-muted-foreground">Reclean Rate</span>
            <div className="text-xl font-bold text-blue-600">
              {op?.recleanRate ?? 0}%
            </div>
            <p className="text-[11px] text-muted-foreground">{op?.recleanCount ?? 0} reclean tickets</p>
          </div>

          <div className="bg-card border p-3.5 rounded-xl space-y-1">
            <span className="text-xs text-muted-foreground">Complaints / 100</span>
            <div className="text-xl font-bold">
              {op?.complaintsPer100Visits ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">{op?.totalComplaints ?? 0} total tickets</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="overview" className="text-xs">Overview & Alerts</TabsTrigger>
            <TabsTrigger value="sla" className="text-xs">SLA & Escalations</TabsTrigger>
            <TabsTrigger value="staff" className="text-xs">Staff Quality Scorecard</TabsTrigger>
            <TabsTrigger value="retention" className="text-xs">Retention & Churn</TabsTrigger>
            <TabsTrigger value="policies" className="text-xs">SLA Policies ({slaPolicies?.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* TAB 1: Overview & Low Rating Alerts */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Rating Distribution */}
              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-sm">Rating Distribution</h4>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = rt?.distribution[stars] ?? 0;
                    const total = rt?.totalCount || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={stars} className="flex items-center gap-3 text-xs">
                        <span className="w-12 font-medium flex items-center gap-1">
                          {stars} <Star size={12} className="fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              stars >= 4 ? "bg-green-500" : stars === 3 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Low Rating Alerts (< 3 stars) */}
              <div className="bg-card border rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-amber-500" /> Recent Quality Alerts (≤ 2★)
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {supervisorHub?.lowRatingVisits?.length ?? 0} alerts
                  </Badge>
                </div>

                <div className="space-y-2.5 max-h-[280px] overflow-y-auto">
                  {(supervisorHub?.lowRatingVisits ?? []).length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No low-rating alerts in the last 7 days! ✨
                    </div>
                  ) : (
                    (supervisorHub?.lowRatingVisits ?? []).map((v: any) => (
                      <div key={v.id} className="p-3 border border-red-500/20 bg-red-500/5 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-red-600 flex items-center gap-1">
                            ★ {v.ratingScore}/5 · Visit #{v.visitId}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        {v.comment && <p className="italic text-foreground">"{v.comment}"</p>}
                        {v.tags && v.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap pt-0.5">
                            {v.tags.map((t: string) => (
                              <Badge key={t} variant="secondary" className="text-[10px] h-4">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {v.complaintId && (
                          <p className="text-[10px] text-primary pt-0.5 font-medium">
                            Auto-created Support Ticket #{v.complaintId}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: SLA & Escalations */}
          <TabsContent value="sla" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Active Attention Tickets */}
              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Clock size={15} /> Active Tickets & SLA Timers
                </h4>
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {(supervisorHub?.attentionTickets ?? []).length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      All tickets are on track or resolved.
                    </div>
                  ) : (
                    (supervisorHub?.attentionTickets ?? []).map((t: any) => {
                      const isBreached = t.slaStatus === "breached";
                      return (
                        <div
                          key={t.id}
                          className={`p-3 rounded-lg border text-xs space-y-1 ${
                            isBreached ? "bg-red-500/10 border-red-500/30" : "bg-card border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold">{t.ticketNumber}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isBreached ? "bg-red-600 text-white" : "bg-primary/10 text-primary"
                              }`}
                            >
                              {t.slaStatus?.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="font-medium">{t.title}</p>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Priority: {t.priority?.toUpperCase()}</span>
                            <span>Due: {t.resolutionDueAt ? new Date(t.resolutionDueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SLA Escalation Audit Trail */}
              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <ShieldAlert size={15} /> SLA Escalation Audit Trail
                </h4>
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {(supervisorHub?.escalationLogs ?? []).length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No SLA escalation events logged.
                    </div>
                  ) : (
                    (supervisorHub?.escalationLogs ?? []).map((e: any) => (
                      <div key={e.id} className="p-3 border rounded-lg bg-amber-500/5 border-amber-500/20 text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-amber-700">Level {e.escalationLevel} Escalation</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p>{e.reason}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Escalated to: <span className="font-medium capitalize">{e.escalatedToRole?.replace(/_/g, " ")}</span>
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Staff Scorecard */}
          <TabsContent value="staff" className="space-y-4">
            <div className="bg-card border rounded-xl p-5 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <Users size={16} /> Cleaner Productivity & Fairness Scorecard
              </h4>
              <p className="text-xs text-muted-foreground">
                Productivity Index accounts for legitimate customer-not-available (CNA) visits and total active load.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2.5">Cleaner Name</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5">Assigned</th>
                      <th className="p-2.5">Completed</th>
                      <th className="p-2.5">CNA Visits</th>
                      <th className="p-2.5">Completion Rate</th>
                      <th className="p-2.5">Productivity Index</th>
                      <th className="p-2.5">Avg Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(analytics?.staffScorecard ?? []).map((s) => (
                      <tr key={s.staffId} className="hover:bg-muted/20">
                        <td className="p-2.5 font-medium">{s.name}</td>
                        <td className="p-2.5 text-muted-foreground font-mono">{s.phone}</td>
                        <td className="p-2.5">{s.assignedVisits}</td>
                        <td className="p-2.5 text-green-600 font-semibold">{s.completedVisits}</td>
                        <td className="p-2.5 text-amber-600">{s.cnaVisits}</td>
                        <td className="p-2.5 font-medium">{s.completionRate}%</td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            {s.productivityIndex}%
                          </Badge>
                        </td>
                        <td className="p-2.5">
                          {s.avgRating != null ? (
                            <span className="flex items-center gap-1 font-semibold text-amber-600">
                              ★ {s.avgRating} <span className="text-muted-foreground font-normal">({s.feedbackCount})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: Retention & Churn */}
          <TabsContent value="retention" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-card border rounded-xl p-5 space-y-2">
                <h4 className="text-xs text-muted-foreground">Customer Retention Rate</h4>
                <div className="text-2xl font-bold text-green-600">{ret?.retentionRate ?? 100}%</div>
                <p className="text-xs text-muted-foreground">Churn Rate: {ret?.churnRate ?? 0}%</p>
                <div className="pt-2 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Active Subscriptions:</span>
                    <span className="font-semibold">{ret?.activeSubscriptions ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paused Subscriptions:</span>
                    <span className="font-semibold">{ret?.pausedSubscriptions ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cancelled Subscriptions:</span>
                    <span className="font-semibold text-destructive">{ret?.cancelledSubscriptions ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-5 space-y-2">
                <h4 className="text-xs text-muted-foreground">Low-Balance Renewals</h4>
                <div className="text-2xl font-bold text-amber-600">{ret?.expiringCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">Subscriptions with ≤ 3 cleanings remaining</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs w-full"
                  disabled={triggerRemindersMutation.isPending}
                  onClick={() => triggerRemindersMutation.mutate()}
                >
                  <RefreshCw size={12} className="mr-1.5" /> Trigger Renewal Alerts
                </Button>
              </div>

              <div className="bg-card border rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-xs">Cancellation Reasons</h4>
                <div className="space-y-1.5 text-xs">
                  {(ret?.cancellationReasons ?? []).length === 0 ? (
                    <p className="text-muted-foreground">No cancellations recorded.</p>
                  ) : (
                    (ret?.cancellationReasons ?? []).map((r) => (
                      <div key={r.reason} className="flex justify-between items-center py-1 border-b">
                        <span className="capitalize">{r.reason.replace(/_/g, " ")}</span>
                        <Badge variant="secondary">{r.count}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: SLA Policies */}
          <TabsContent value="policies" className="space-y-4">
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-sm">Configured SLA Policies</h4>
                  <p className="text-xs text-muted-foreground">
                    Custom response and resolution time targets by city, category, and priority.
                  </p>
                </div>
                <Button size="sm" onClick={() => setNewPolicyOpen(true)} className="text-xs gap-1.5">
                  <Plus size={13} /> Add SLA Policy
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2.5">Policy Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Priority</th>
                      <th className="p-2.5">Response Target</th>
                      <th className="p-2.5">Resolution Target</th>
                      <th className="p-2.5">Level 1 Escalation</th>
                      <th className="p-2.5">Level 2 Escalation</th>
                      <th className="p-2.5">Pause on Customer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(slaPolicies?.data ?? []).map((p) => (
                      <tr key={p.id}>
                        <td className="p-2.5 font-semibold">{p.name}</td>
                        <td className="p-2.5 capitalize">{p.category}</td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {p.priority}
                          </Badge>
                        </td>
                        <td className="p-2.5">{p.responseTargetMinutes} mins ({Math.round(p.responseTargetMinutes / 60)}h)</td>
                        <td className="p-2.5">{p.resolutionTargetMinutes} mins ({Math.round(p.resolutionTargetMinutes / 60)}h)</td>
                        <td className="p-2.5">{p.escalationLevel1Minutes ? `${p.escalationLevel1Minutes} mins` : "—"}</td>
                        <td className="p-2.5">{p.escalationLevel2Minutes ? `${p.escalationLevel2Minutes} mins` : "—"}</td>
                        <td className="p-2.5">{p.pauseOnCustomerResponse ? "✓ Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create SLA Policy Modal */}
        <Dialog open={newPolicyOpen} onOpenChange={setNewPolicyOpen}>
          <DialogContent className="max-w-md text-xs">
            <DialogHeader>
              <DialogTitle className="text-sm">Create Configurable SLA Policy</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div>
                <Label>Policy Name</Label>
                <Input
                  value={policyForm.name}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. VIP Noida High-Rise Quality SLA"
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={policyForm.category}
                    onValueChange={(val) => setPolicyForm((f) => ({ ...f, category: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="reclean">Reclean</SelectItem>
                      <SelectItem value="damage">Damage Claim</SelectItem>
                      <SelectItem value="missed">Missed Cleaning</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select
                    value={policyForm.priority}
                    onValueChange={(val) => setPolicyForm((f) => ({ ...f, priority: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Response Target (Minutes)</Label>
                  <Input
                    type="number"
                    value={policyForm.responseTargetMinutes}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, responseTargetMinutes: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label>Resolution Target (Minutes)</Label>
                  <Input
                    type="number"
                    value={policyForm.resolutionTargetMinutes}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, resolutionTargetMinutes: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Level 1 Escalation (Mins)</Label>
                  <Input
                    type="number"
                    value={policyForm.escalationLevel1Minutes}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, escalationLevel1Minutes: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label>Level 2 Escalation (Mins)</Label>
                  <Input
                    type="number"
                    value={policyForm.escalationLevel2Minutes}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, escalationLevel2Minutes: Number(e.target.value) }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-3">
              <Button variant="outline" size="sm" onClick={() => setNewPolicyOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={createPolicyMutation.isPending || !policyForm.name.trim()}
                onClick={() => createPolicyMutation.mutate()}
              >
                {createPolicyMutation.isPending ? "Creating..." : "Save SLA Policy"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
