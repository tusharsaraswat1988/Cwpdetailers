import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Gift, Copy, Check, ArrowRight, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function LoyaltyRewardsCard() {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/loyalty/my-rewards", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setBalance(data.loyalty.balance);
          setReferralCode(data.referral.referralCode);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Code Copied!",
      description: "Share your referral code to earn 200 points (₹200)!",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-slate-200/90 bg-gradient-to-r from-amber-50/60 via-orange-50/40 to-amber-50/60 shadow-sm rounded-2xl overflow-hidden" data-testid="loyalty-rewards-banner">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/20">
            <Gift size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">CWP Loyalty & Rewards</span>
              {balance != null && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-bold">
                  {balance} Points (₹{balance})
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Invite friends to get ₹200 on their first wash. Redeem points at checkout.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {referralCode && (
            <Button
              onClick={() => handleCopy(referralCode)}
              variant="outline"
              size="sm"
              className="bg-white text-xs font-mono gap-1.5 border-slate-200"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {referralCode}
            </Button>
          )}

          <Link href="/customer/loyalty">
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1">
              View Rewards
              <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
