import { useState, useEffect } from "react";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Gift,
  Share2,
  Copy,
  Check,
  Users,
  Award,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface RewardsData {
  customerId: number;
  referral: {
    referralCode: string;
    shareUrl: string;
    stats: {
      friendsInvited: number;
      signupsCompleted: number;
      firstBookingsCompleted: number;
      rewardsEarnedPoints: number;
      pendingRewardsCount: number;
    };
    terms: string;
    referralHistory: Array<{
      id: number;
      refereeName: string;
      status: string;
      rewardStatus: string;
      referrerRewardPoints: number;
      createdAt: string;
      bookingCompletedAt: string | null;
    }>;
  };
  loyalty: {
    balance: number;
    rupeeValue: number;
    recentActivity: Array<{
      id: number;
      transactionType: string;
      points: number;
      rupeeEquivalent: string;
      sourceReference: string;
      status: string;
      notes: string | null;
      createdAt: string;
    }>;
  };
}

export default function LoyaltyRewardsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [attributing, setAttributing] = useState(false);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loyalty/my-rewards", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to load loyalty rewards data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Referral Code Copied!",
      description: "Share it with your friends to earn 200 points on their first wash.",
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = (code: string) => {
    const text = encodeURIComponent(
      `Hey! Get ₹100 off your first doorstep car cleaning with CWP Detailers! Sign up using my referral code: ${code}\nhttps://cwpdetailers.in/register?ref=${code}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleAttributeReferral = async () => {
    if (!referralInput.trim()) return;
    setAttributing(true);
    try {
      const res = await fetch("/api/loyalty/referrals/attribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: referralInput.trim() }),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        toast({
          title: "Referral Code Invalid",
          description: result.error || "Could not apply referral code.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Referral Applied!",
        description: result.message,
      });
      setReferralInput("");
      fetchRewards();
    } catch {
      toast({
        title: "Error",
        description: "Failed to attribute referral code.",
        variant: "destructive",
      });
    } finally {
      setAttributing(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6" data-testid="loyalty-rewards-page">
        {/* Header Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground border border-primary/30 text-xs font-semibold uppercase tracking-wider">
                <Sparkles size={14} className="text-amber-400" />
                CWP Rewards & Loyalty
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Earn Points on Every Shine
              </h1>
              <p className="text-slate-300 text-sm max-w-lg">
                Redeem your points directly at checkout for instant discounts. Every 1 Point = ₹1 off your booking.
              </p>
            </div>

            {/* Points Balance Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 min-w-[220px] text-center md:text-right">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-300">Available Points</p>
              <div className="text-4xl font-black text-amber-400 tracking-tight mt-1">
                {loading ? "..." : (data?.loyalty.balance ?? 0)}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Worth <span className="font-bold text-white">₹{data?.loyalty.rupeeValue ?? 0}</span> in discounts
              </p>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Referral Engine & Quick Attribute */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Referral Card */}
          <Card className="lg:col-span-2 border-slate-200/90 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                    <Gift size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Invite Friends, Earn ₹200</CardTitle>
                    <CardDescription>Share your unique code with neighbors and friends</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Code Display & Action Row */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Your Referral Code</p>
                  <p className="text-2xl font-mono font-black text-slate-900 tracking-wider">
                    {loading ? "GENERATING..." : (data?.referral.referralCode ?? "CWP-FRIEND")}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={() => data?.referral.referralCode && handleCopyCode(data.referral.referralCode)}
                    variant="outline"
                    className="flex-1 sm:flex-none gap-1.5"
                  >
                    {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy Code"}
                  </Button>
                  <Button
                    onClick={() => data?.referral.referralCode && handleShareWhatsApp(data.referral.referralCode)}
                    className="flex-1 sm:flex-none gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Share2 size={16} />
                    WhatsApp
                  </Button>
                </div>
              </div>

              {/* Referral Progress Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-center">
                  <p className="text-2xl font-bold text-slate-900">{data?.referral.stats.friendsInvited ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Friends Invited</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-center">
                  <p className="text-2xl font-bold text-slate-900">{data?.referral.stats.signupsCompleted ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Signed Up</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{data?.referral.stats.firstBookingsCompleted ?? 0}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Washes Done</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100 text-center">
                  <p className="text-2xl font-bold text-amber-700">{data?.referral.stats.rewardsEarnedPoints ?? 0}</p>
                  <p className="text-xs text-amber-600 font-medium mt-0.5">Points Earned</p>
                </div>
              </div>

              {/* Explanatory Steps */}
              <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100/80 space-y-2 text-xs text-slate-700">
                <p className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <HelpCircle size={14} /> How it works:
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Send your referral code or link to a friend.</li>
                  <li>Your friend gets 100 points (₹100 discount) on their first service.</li>
                  <li>Once their service is completed and paid, you receive 200 points (₹200) instantly!</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Side Card: Have a friend's code? */}
          <div className="space-y-6">
            <Card className="border-slate-200/90 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users size={18} className="text-primary" />
                  Have a Referral Code?
                </CardTitle>
                <CardDescription>Enter a friend's referral code to unlock your bonus</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Input
                    placeholder="e.g. CWPRAVI8421"
                    value={referralInput}
                    onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                    className="font-mono uppercase tracking-wider"
                  />
                  <Button
                    onClick={handleAttributeReferral}
                    disabled={attributing || !referralInput.trim()}
                    className="w-full"
                  >
                    {attributing ? "Applying..." : "Claim Referral Bonus"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bonus points are automatically credited after your first completed doorstep wash.
                </p>
              </CardContent>
            </Card>

            {/* How to Earn Card */}
            <Card className="border-slate-200/90 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award size={18} className="text-amber-500" />
                  Earning Rewards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span>Every ₹100 spent</span>
                  <Badge variant="outline" className="font-semibold text-slate-900">+5 Points</Badge>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span>First Service Bonus</span>
                  <Badge variant="outline" className="font-semibold text-emerald-700 bg-emerald-50">+50 Points</Badge>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span>Friend's First Service</span>
                  <Badge variant="outline" className="font-semibold text-amber-700 bg-amber-50">+200 Points</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Points Activity Ledger */}
        <Card className="border-slate-200/90 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp size={20} className="text-primary" />
                  Rewards Activity History
                </CardTitle>
                <CardDescription>All points credited, redeemed, or adjusted</CardDescription>
              </div>
              <Badge variant="outline">{data?.loyalty.recentActivity.length ?? 0} transactions</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(data?.loyalty.recentActivity ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                No points transactions yet. Complete your first service or refer a friend to get started!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data?.loyalty.recentActivity.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 capitalize">
                          {tx.sourceReference.replace(/_/g, " ")}
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            tx.transactionType === "credit"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700"
                          }
                        >
                          {tx.transactionType}
                        </Badge>
                      </div>
                      {tx.notes && <p className="text-xs text-muted-foreground">{tx.notes}</p>}
                      <p className="text-xs text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-base font-bold ${
                          tx.transactionType === "credit" ? "text-emerald-600" : "text-slate-700"
                        }`}
                      >
                        {tx.transactionType === "credit" ? `+${tx.points}` : `-${tx.points}`} pts
                      </span>
                      <p className="text-xs text-muted-foreground">₹{tx.rupeeEquivalent}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}
