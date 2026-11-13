import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Users,
  Award,
  TrendingUp,
  Settings,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Plus,
  RefreshCw,
  Gift,
} from "lucide-react";

export default function LoyaltyAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // State
  const [overview, setOverview] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Customer Ledger Search
  const [searchCustomerId, setSearchCustomerId] = useState("");
  const [customerLedger, setCustomerLedger] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Run Automation Dialog
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [runResults, setRunResults] = useState<any[] | null>(null);
  const [running, setRunning] = useState(false);

  // Manual Adjust Dialog
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fetchOverview = async () => {
    try {
      const res = await fetch("/api/loyalty/admin/overview", { credentials: "include" });
      if (res.ok) setOverview(await res.json());
    } catch {}
  };

  const fetchReferrals = async () => {
    try {
      const res = await fetch("/api/loyalty/admin/referrals", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setReferrals(json.referrals || []);
      }
    } catch {}
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/loyalty/admin/config", { credentials: "include" });
      if (res.ok) setConfig(await res.json());
    } catch {}
  };

  const fetchAutomations = async () => {
    try {
      const res = await fetch("/api/loyalty/admin/automations", { credentials: "include" });
      if (res.ok) setAutomations(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchOverview();
    fetchReferrals();
    fetchConfig();
    fetchAutomations();
  }, []);

  const handleSaveConfig = async () => {
    if (!config) return;
    setLoading(true);
    try {
      const res = await fetch("/api/loyalty/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Configuration Saved", description: "Loyalty program settings updated successfully." });
      } else {
        toast({ title: "Save Error", description: "Could not update settings.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Save Error", description: "Network error saving settings.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchLedger = async () => {
    const id = parseInt(searchCustomerId, 10);
    if (isNaN(id) || id <= 0) return;
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/loyalty/admin/customer-ledger/${id}`, { credentials: "include" });
      if (res.ok) {
        setCustomerLedger(await res.json());
      } else {
        toast({ title: "Customer Not Found", description: `No customer found with ID #${id}`, variant: "destructive" });
        setCustomerLedger(null);
      }
    } catch {
      toast({ title: "Search Error", description: "Failed to load customer ledger", variant: "destructive" });
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleRunAutomations = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/loyalty/admin/automations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setRunResults(data.results || []);
        toast({
          title: dryRun ? "Dry-Run Complete" : "Automations Dispatched",
          description: `Evaluated ${data.results?.length ?? 0} active retention automations.`,
        });
        fetchOverview();
        fetchAutomations();
      }
    } catch {
      toast({ title: "Execution Error", description: "Failed to execute automations.", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const handleAdjustPoints = async () => {
    if (!customerLedger?.customer?.id || !adjustPoints || !adjustNotes.trim()) return;
    setAdjusting(true);
    try {
      const res = await fetch("/api/loyalty/admin/ledger/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerLedger.customer.id,
          points: parseInt(adjustPoints, 10),
          type: adjustType,
          notes: adjustNotes.trim(),
        }),
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Points Adjusted", description: `Successfully recorded ${adjustType} adjustment.` });
        setAdjustModalOpen(false);
        setAdjustPoints("");
        setAdjustNotes("");
        handleSearchLedger();
        fetchOverview();
      } else {
        const err = await res.json();
        toast({ title: "Adjustment Failed", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network Error", description: "Failed to process adjustment", variant: "destructive" });
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6" data-testid="loyalty-admin-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-amber-500" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Loyalty, Referrals & Retention Engine
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configuration-driven customer rewards, referral attribution, wallet points ledger, and retention automations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                fetchOverview();
                fetchReferrals();
                fetchConfig();
                fetchAutomations();
                toast({ title: "Refreshed Data" });
              }}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw size={14} /> Refresh
            </Button>
            <Button
              onClick={() => {
                setRunModalOpen(true);
                setRunResults(null);
              }}
              size="sm"
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Play size={14} /> Run Automations
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-100 p-1 border border-slate-200">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <TrendingUp size={14} /> Overview
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-1.5 text-xs">
              <Users size={14} /> Referrals ({referrals.length})
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 text-xs">
              <Settings size={14} /> Loyalty Config
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-1.5 text-xs">
              <Clock size={14} /> Retention Automations ({automations.length})
            </TabsTrigger>
            <TabsTrigger value="ledger" className="gap-1.5 text-xs">
              <Award size={14} /> Customer Points Ledger
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase font-semibold text-muted-foreground">Referral Signups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{overview?.referrals.totalSignups ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold text-emerald-600">{overview?.referrals.completedConversions ?? 0} converted</span> ({overview?.referrals.conversionRatePct ?? 0}%)
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase font-semibold text-muted-foreground">Referral Rewards Issued</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{overview?.referrals.rewardsIssuedPoints ?? 0} pts</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ₹{overview?.referrals.rewardsIssuedPoints ?? 0} equivalent value
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase font-semibold text-muted-foreground">Total Points Issued</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">{overview?.loyalty.totalPointsIssued ?? 0} pts</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overview?.loyalty.totalPointsRedeemed ?? 0} pts redeemed
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase font-semibold text-muted-foreground">Outstanding Points Liability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">₹{overview?.loyalty.rupeeLiabilityValue ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overview?.loyalty.outstandingPointsLiability ?? 0} active points unredeemed
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Retention Quick Summary */}
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock size={18} className="text-primary" />
                  Retention Automation Health
                </CardTitle>
                <CardDescription>Automated lifecycle nudges sent across customers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-muted-foreground">Active Automations</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{overview?.retention.activeAutomations ?? 0}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-xs text-emerald-700">Messages Sent</p>
                    <p className="text-xl font-bold text-emerald-800 mt-1">{overview?.retention.totalMessagesSent ?? 0}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-muted-foreground">Execution Failures</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{overview?.retention.totalFailures ?? 0}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-700">Channels</p>
                    <p className="text-xl font-bold text-blue-800 mt-1">In-App, SMS</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: REFERRALS */}
          <TabsContent value="referrals" className="space-y-4">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users size={18} className="text-primary" />
                  Customer Referrals Directory
                </CardTitle>
                <CardDescription>Track referral code attributions, first bookings, and reward status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs text-left divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="p-3">Ref ID</th>
                        <th className="p-3">Code</th>
                        <th className="p-3">Referrer</th>
                        <th className="p-3">Referee</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Reward</th>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {referrals.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-muted-foreground">
                            No referral records recorded yet.
                          </td>
                        </tr>
                      ) : (
                        referrals.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-medium">#{r.id}</td>
                            <td className="p-3 font-mono font-bold text-primary">{r.referralCode}</td>
                            <td className="p-3 font-medium">Cust #{r.referrerId}</td>
                            <td className="p-3 font-medium">Cust #{r.refereeId}</td>
                            <td className="p-3">
                              <Badge
                                variant="secondary"
                                className={
                                  r.status === "completed"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }
                              >
                                {r.status}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className={
                                  r.rewardStatus === "rewarded"
                                    ? "text-emerald-700 border-emerald-300"
                                    : "text-slate-500"
                                }
                              >
                                {r.rewardStatus === "rewarded"
                                  ? `+${r.referrerRewardPoints} pts`
                                  : r.rewardStatus}
                              </Badge>
                            </td>
                            <td className="p-3 font-mono">{r.attributedBookingId ? `#${r.attributedBookingId}` : "—"}</td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(r.createdAt).toLocaleDateString("en-IN")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: CONFIGURATION */}
          <TabsContent value="config" className="space-y-4">
            <Card className="rounded-2xl border-slate-200 shadow-sm max-w-3xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings size={18} className="text-primary" />
                  Universal Loyalty Program Rules
                </CardTitle>
                <CardDescription>
                  Configure points accrual, redemption caps, and referral bonuses. Rules apply deterministically across bookings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {config && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Points per ₹100 spent</Label>
                      <Input
                        type="number"
                        value={config.pointsPer100Spent}
                        onChange={(e) => setConfig({ ...config, pointsPer100Spent: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Default: 5 points (5% return rate)</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">First Booking Bonus (Points)</Label>
                      <Input
                        type="number"
                        value={config.firstBookingBonusPoints}
                        onChange={(e) => setConfig({ ...config, firstBookingBonusPoints: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Awarded on customer's first completed wash</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Referrer Reward (Points)</Label>
                      <Input
                        type="number"
                        value={config.referrerRewardPoints}
                        onChange={(e) => setConfig({ ...config, referrerRewardPoints: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Credited to referring friend (e.g. 200 pts = ₹200)</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Referee Welcome Reward (Points)</Label>
                      <Input
                        type="number"
                        value={config.refereeRewardPoints}
                        onChange={(e) => setConfig({ ...config, refereeRewardPoints: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Credited to invited new customer (e.g. 100 pts = ₹100)</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Rupee Value per Point (₹)</Label>
                      <Input
                        value={config.redemptionRupeesPerPoint}
                        onChange={(e) => setConfig({ ...config, redemptionRupeesPerPoint: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">Default: 1.00 (1 Point = ₹1)</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Min Redemption Points</Label>
                      <Input
                        type="number"
                        value={config.minRedemptionPoints}
                        onChange={(e) => setConfig({ ...config, minRedemptionPoints: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Minimum points required to redeem at checkout</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Max Redemption Points per Order</Label>
                      <Input
                        type="number"
                        value={config.maxRedemptionPointsPerOrder}
                        onChange={(e) => setConfig({ ...config, maxRedemptionPointsPerOrder: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Hard cap per single booking checkout</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Max Order Value Coverage (%)</Label>
                      <Input
                        type="number"
                        value={config.maxRedemptionPercentageOrder}
                        onChange={(e) => setConfig({ ...config, maxRedemptionPercentageOrder: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Max % of booking payable using points (e.g. 50%)</p>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Points Validity Period (Days)</Label>
                      <Input
                        type="number"
                        value={config.pointsValidityDays}
                        onChange={(e) => setConfig({ ...config, pointsValidityDays: Number(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">Points expire after this number of days (e.g. 180 days)</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <Button onClick={handleSaveConfig} disabled={loading} className="gap-1.5">
                    {loading ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: AUTOMATIONS */}
          <TabsContent value="automations" className="space-y-4">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock size={18} className="text-primary" />
                    Lifecycle Retention Automations
                  </CardTitle>
                  <CardDescription>Configured triggers running automated nudges and bonus offers</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setRunModalOpen(true);
                    setRunResults(null);
                  }}
                  size="sm"
                  className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Play size={14} /> Run Automations
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs text-left divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="p-3">Campaign Name</th>
                        <th className="p-3">Trigger Type</th>
                        <th className="p-3">Delay</th>
                        <th className="p-3">Coupon / Points</th>
                        <th className="p-3">Frequency Cap</th>
                        <th className="p-3">Evaluated / Triggered</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {automations.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">{a.name}</td>
                          <td className="p-3 font-mono text-primary">{a.triggerType}</td>
                          <td className="p-3">{a.delayDays} days</td>
                          <td className="p-3">
                            {a.couponCode && <Badge variant="outline" className="mr-1">{a.couponCode}</Badge>}
                            {a.rewardPoints > 0 && <span className="text-emerald-700 font-bold">+{a.rewardPoints} pts</span>}
                            {!a.couponCode && a.rewardPoints === 0 && <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3">1 per {a.frequencyCapDays} days</td>
                          <td className="p-3 font-mono">{a.totalEvaluatedCount} / {a.totalTriggeredCount}</td>
                          <td className="p-3">
                            <Badge
                              variant="secondary"
                              className={a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}
                            >
                              {a.isActive ? "Active" : "Paused"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: CUSTOMER LEDGER */}
          <TabsContent value="ledger" className="space-y-4">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search size={18} className="text-primary" />
                  Customer Rewards Ledger Inspection
                </CardTitle>
                <CardDescription>Look up customer points balance, transactions, and manual adjustments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search Bar */}
                <div className="flex items-center gap-3 max-w-md">
                  <Input
                    type="number"
                    placeholder="Enter Customer ID (e.g. 1)"
                    value={searchCustomerId}
                    onChange={(e) => setSearchCustomerId(e.target.value)}
                  />
                  <Button onClick={handleSearchLedger} disabled={ledgerLoading || !searchCustomerId} className="shrink-0 gap-1.5">
                    {ledgerLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                    Search
                  </Button>
                </div>

                {/* Customer Details & Actions */}
                {customerLedger && (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-900">{customerLedger.customer.name}</span>
                          <Badge variant="outline">Cust #{customerLedger.customer.id}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Phone: {customerLedger.customer.phone} · Referral Code:{" "}
                          <span className="font-mono font-bold text-primary">{customerLedger.customer.referralCode || "None"}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Current Balance</p>
                          <p className="text-2xl font-black text-amber-600">{customerLedger.balance} pts</p>
                          <p className="text-xs text-slate-500">₹{customerLedger.rupeeValue} discount</p>
                        </div>
                        <Button
                          onClick={() => setAdjustModalOpen(true)}
                          size="sm"
                          variant="outline"
                          className="gap-1"
                        >
                          <Plus size={14} /> Adjust Points
                        </Button>
                      </div>
                    </div>

                    {/* Ledger Transactions Table */}
                    <div className="rounded-xl border border-slate-200 overflow-x-auto">
                      <table className="w-full text-xs text-left divide-y divide-slate-100">
                        <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                          <tr>
                            <th className="p-3">Tx ID</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Points</th>
                            <th className="p-3">Rupee Equiv</th>
                            <th className="p-3">Balance After</th>
                            <th className="p-3">Source Reference</th>
                            <th className="p-3">Booking ID</th>
                            <th className="p-3">Notes</th>
                            <th className="p-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customerLedger.entries.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-6 text-center text-muted-foreground">
                                No ledger transactions found for this customer.
                              </td>
                            </tr>
                          ) : (
                            customerLedger.entries.map((tx: any) => (
                              <tr key={tx.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-mono font-medium">#{tx.id}</td>
                                <td className="p-3">
                                  <Badge
                                    variant="secondary"
                                    className={
                                      tx.transactionType === "credit"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-700"
                                    }
                                  >
                                    {tx.transactionType}
                                  </Badge>
                                </td>
                                <td className="p-3 font-bold font-mono">
                                  {tx.transactionType === "credit" ? `+${tx.points}` : `-${tx.points}`}
                                </td>
                                <td className="p-3">₹{tx.rupeeEquivalent}</td>
                                <td className="p-3 font-mono font-bold">{tx.balanceAfter} pts</td>
                                <td className="p-3 capitalize">{tx.sourceReference.replace(/_/g, " ")}</td>
                                <td className="p-3 font-mono">{tx.bookingId ? `#${tx.bookingId}` : "—"}</td>
                                <td className="p-3 text-muted-foreground">{tx.notes || "—"}</td>
                                <td className="p-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleString("en-IN")}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG 1: RUN AUTOMATIONS */}
        <Dialog open={runModalOpen} onOpenChange={setRunModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Run Retention Automations</DialogTitle>
              <DialogDescription>
                Evaluate candidate customers and trigger scheduled lifecycle notifications.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Dry-Run Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Simulate execution and preview eligible recipient counts without sending notifications.
                  </p>
                </div>
                <Switch checked={dryRun} onCheckedChange={setDryRun} />
              </div>

              {runResults && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs uppercase font-bold text-slate-500">Evaluation Results</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {runResults.map((r, i) => (
                      <div key={i} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span>{r.automationName}</span>
                          <Badge variant="outline">{r.triggerType}</Badge>
                        </div>
                        <p className="text-slate-600">
                          Evaluated: <span className="font-semibold">{r.evaluatedCount}</span> · Triggered:{" "}
                          <span className="font-semibold text-emerald-600">{r.triggeredCount}</span> · Skipped Frequency Cap:{" "}
                          <span className="font-semibold text-amber-600">{r.skippedFrequencyCapCount}</span> · Skipped Consent:{" "}
                          <span className="font-semibold text-slate-500">{r.skippedConsentCount}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRunModalOpen(false)}>Close</Button>
              <Button onClick={handleRunAutomations} disabled={running} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {dryRun ? "Simulate Dry-Run" : "Execute Live"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG 2: ADJUST POINTS */}
        <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Customer Points</DialogTitle>
              <DialogDescription>
                Record an administrative points adjustment. Requires an audit reason.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Adjustment Type</Label>
                <Select value={adjustType} onValueChange={(v: "credit" | "debit") => setAdjustType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit Points (+)</SelectItem>
                    <SelectItem value="debit">Debit Points (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Points Amount</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Audit Reason / Notes (Required)</Label>
                <Input
                  placeholder="e.g. Customer goodwill adjustment / resolution"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjustPoints} disabled={adjusting || !adjustPoints || !adjustNotes.trim()}>
                {adjusting ? "Processing..." : "Confirm Adjustment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
