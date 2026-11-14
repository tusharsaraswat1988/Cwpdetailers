import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AccountSection } from "./AccountSection";
import { Gift, Copy, Check, ArrowRight, Sparkles, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

export function LoyaltyReferralSection() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data } = useQuery<{
    loyalty?: { balance: number; rupeeValue: number };
    referral?: { referralCode: string };
  }>({
    queryKey: ["customer-rewards-account-widget"],
    queryFn: async () => {
      const res = await fetch("/api/loyalty/my-rewards", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });

  const balance = data?.loyalty?.balance ?? 0;
  const rupeeValue = data?.loyalty?.rupeeValue ?? balance;
  const referralCode = data?.referral?.referralCode || "";

  const copyReferral = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({
      title: "Referral Code Copied!",
      description: `Share ${referralCode} with friends to earn ₹200 on their first wash.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AccountSection title="Loyalty & Referral Rewards" icon={<Gift size={16} />}>
      <div className="space-y-3">
        {/* Balance & Value Row */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Reward Points Balance
              </p>
              <p className="font-display font-black text-lg text-amber-950">
                {balance.toLocaleString()} pts{" "}
                <span className="text-xs font-semibold text-amber-700">(₹{rupeeValue} value)</span>
              </p>
            </div>
          </div>

          <Link
            href={CUSTOMER_ROUTES.rewards}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 shrink-0"
          >
            Redeem <ArrowRight size={13} />
          </Link>
        </div>

        {/* Referral Code Quick Copy */}
        {referralCode && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Your Referral Code
              </p>
              <p className="font-mono font-bold text-sm text-foreground tracking-wider mt-0.5">
                {referralCode}
              </p>
            </div>

            <button
              type="button"
              onClick={copyReferral}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-foreground hover:bg-slate-100 flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy Code
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </AccountSection>
  );
}
