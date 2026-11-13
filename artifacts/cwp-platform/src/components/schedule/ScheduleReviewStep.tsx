import { useState } from "react";
import { ServiceAddressRow } from "@/components/shared/ServiceAddressRow";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LocationValue } from "@/features/master-data/api";
import type { CustomerPlan } from "@/lib/customer-plans";
import type { ScheduleAsset, PlanMode } from "@/lib/schedule-journey";
import { formatDateLabel } from "@/lib/schedule-slots";
import { CheckCircle2, Tag, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface AppliedCouponInfo {
  code: string;
  discountAmount: number;
  finalPayable: number;
  discountPercentage?: number;
}

interface ScheduleReviewStepProps {
  asset: ScheduleAsset;
  address: LocationValue;
  planMode: PlanMode;
  plan: CustomerPlan | null;
  serviceName: string;
  date: string;
  time: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onChangeAddress: () => void;
  estimatedPrice: number | null;
  coveredByPlan: boolean;
  siteVisitRequired?: boolean;
  gstExtra?: boolean;
  serviceId?: string;
  appliedCoupon?: AppliedCouponInfo | null;
  onApplyCoupon?: (coupon: AppliedCouponInfo | null) => void;
  appliedLoyaltyPoints?: { points: number; discountAmount: number } | null;
  onApplyLoyaltyPoints?: (redemption: { points: number; discountAmount: number } | null) => void;
}

export function ScheduleReviewStep({
  asset,
  address,
  planMode,
  plan,
  serviceName,
  date,
  time,
  notes,
  onNotesChange,
  onChangeAddress,
  estimatedPrice,
  coveredByPlan,
  siteVisitRequired = false,
  gstExtra = false,
  serviceId,
  appliedCoupon = null,
  onApplyCoupon,
  appliedLoyaltyPoints = null,
  onApplyLoyaltyPoints,
}: ScheduleReviewStepProps) {
  const { toast } = useToast();
  const [couponInput, setCouponInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [pointsInput, setPointsInput] = useState<string>("");
  const [redeemingPoints, setRedeemingPoints] = useState(false);

  useEffect(() => {
    fetch("/api/loyalty/my-rewards", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.loyalty?.balance) setAvailablePoints(d.loyalty.balance);
      })
      .catch(() => {});
  }, []);

  const handleApplyPoints = async () => {
    const pts = parseInt(pointsInput, 10);
    if (isNaN(pts) || pts <= 0 || !estimatedPrice) return;
    setRedeemingPoints(true);
    try {
      const res = await fetch("/api/loyalty/validate-redemption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsToRedeem: pts,
          orderAmount: estimatedPrice,
          cityId: address.cityId || null,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.isValid) {
        toast({
          title: "Cannot Redeem Points",
          description: data.errorMessage || "Points could not be applied.",
          variant: "destructive",
        });
        return;
      }

      onApplyLoyaltyPoints?.({
        points: pts,
        discountAmount: data.discountAmount,
      });

      toast({
        title: "Points Applied!",
        description: `Redeemed ${pts} points for ₹${data.discountAmount} discount.`,
      });
      setPointsInput("");
    } catch {
      toast({
        title: "Redemption Error",
        description: "Failed to validate loyalty points.",
        variant: "destructive",
      });
    } finally {
      setRedeemingPoints(false);
    }
  };

  const handleRemovePoints = () => {
    onApplyLoyaltyPoints?.(null);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !estimatedPrice) return;
    setValidating(true);
    try {
      const res = await fetch("/api/marketing/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponInput.trim(),
          orderAmount: estimatedPrice,
          cityId: address.cityId || null,
          serviceId: serviceId ? parseInt(serviceId, 10) : null,
          vehicleCategory: asset.kind === "vehicle" ? (asset as { vehicleType?: string }).vehicleType : null,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.isValid) {
        toast({
          title: "Invalid Coupon",
          description: data.errorMessage || "This coupon could not be applied.",
          variant: "destructive",
        });
        return;
      }

      onApplyCoupon?.({
        code: couponInput.trim().toUpperCase(),
        discountAmount: data.discountAmount,
        finalPayable: data.finalPayable,
        discountPercentage: data.discountPercentage,
      });

      toast({
        title: "Coupon Applied!",
        description: `You saved ₹${data.discountAmount} on this booking.`,
      });
      setCouponInput("");
    } catch {
      toast({
        title: "Validation Error",
        description: "Failed to validate coupon code.",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    onApplyCoupon?.(null);
  };

  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const loyaltyDiscount = appliedLoyaltyPoints?.discountAmount ?? 0;
  const finalPrice = Math.max(0, (estimatedPrice ?? 0) - couponDiscount - loyaltyDiscount);

  return (
    <div className="space-y-4" data-testid="schedule-step-review">
      <div className="rounded-2xl border border-slate-200/90 bg-white divide-y divide-slate-100 text-sm shadow-[0_2px_8px_rgba(11,29,54,0.04)] overflow-hidden">
        <Row label="Vehicle / Asset" value={`${asset.name}${asset.subtitle ? ` (${asset.subtitle})` : ""}`} />
        <div className="p-3.5 sm:p-4">
          <ServiceAddressRow value={address} onChangeClick={onChangeAddress} label="Service Address" />
        </div>
        <Row label="Plan / Mode" value={planMode === "plan" && plan ? plan.name : "One-Time Service"} />
        <Row label="Selected Service" value={serviceName} />
        <Row label="Service Date" value={`${formatDateLabel(date)} · ${date}`} />
        <Row label="Arrival Window" value={time} />
      </div>

      <div>
        <Label htmlFor="schedule-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Special instructions (optional)
        </Label>
        <textarea
          id="schedule-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="E.g., Key at security desk, park in basement B2, etc."
          className="mt-1.5 flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
          data-testid="schedule-notes"
        />
      </div>

      {siteVisitRequired && !coveredByPlan && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3 text-sm space-y-1">
          <p className="font-semibold text-amber-900">Site visit required</p>
          <p className="text-amber-800 text-xs leading-relaxed">
            For this panel count we confirm rates after a site visit. Request a callback below — our team will call you to schedule the visit, then book at the agreed rate.
          </p>
        </div>
      )}

      {/* Coupon Code Section */}
      {estimatedPrice != null && !coveredByPlan && !siteVisitRequired && (
        <div className="rounded-xl border border-slate-200 bg-card p-3.5 shadow-2xs space-y-2">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Tag size={13} className="text-primary" /> Have a Promo / Coupon Code?
          </Label>

          {appliedCoupon ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-700" />
                <span className="font-mono font-bold text-emerald-800">{appliedCoupon.code}</span>
                <span className="text-emerald-700">(-₹{appliedCoupon.discountAmount} saved)</span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 cursor-pointer"
              >
                <X size={13} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter coupon (e.g. WELCOME50)"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="h-8 text-xs font-mono uppercase"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3 font-semibold shrink-0"
                disabled={validating || !couponInput.trim()}
                onClick={handleApplyCoupon}
              >
                {validating ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loyalty Points Redemption Section */}
      {estimatedPrice != null && !coveredByPlan && !siteVisitRequired && availablePoints > 0 && (
        <div className="rounded-xl border border-slate-200 bg-card p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Gift size={13} className="text-amber-500" /> Redeem Loyalty Points
            </Label>
            <Badge variant="outline" className="text-[11px] font-semibold text-amber-700 bg-amber-50 border-amber-200">
              {availablePoints} pts available (₹{availablePoints})
            </Badge>
          </div>

          {appliedLoyaltyPoints ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-amber-700" />
                <span className="font-bold text-amber-900">{appliedLoyaltyPoints.points} Points Applied</span>
                <span className="text-amber-700">(-₹{appliedLoyaltyPoints.discountAmount} discount)</span>
              </div>
              <button
                type="button"
                onClick={handleRemovePoints}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 cursor-pointer"
              >
                <X size={13} /> Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={`Points to redeem (min 50, max ${Math.min(availablePoints, 500)})`}
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                className="h-8 text-xs font-mono"
                min={50}
                max={availablePoints}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3 font-semibold shrink-0"
                disabled={redeemingPoints || !pointsInput.trim()}
                onClick={handleApplyPoints}
              >
                {redeemingPoints ? <Loader2 size={12} className="animate-spin" /> : "Redeem"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Price Summary Breakdown */}
      {estimatedPrice != null && !coveredByPlan && !siteVisitRequired && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm space-y-1.5 shadow-2xs">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Service Base Price</span>
            <span>₹{estimatedPrice.toLocaleString("en-IN")}</span>
          </div>

          {appliedCoupon && (
            <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold">
              <span>Coupon Discount ({appliedCoupon.code})</span>
              <span>-₹{appliedCoupon.discountAmount.toLocaleString("en-IN")}</span>
            </div>
          )}

          {appliedLoyaltyPoints && (
            <div className="flex justify-between items-center text-xs text-amber-700 font-semibold">
              <span>Loyalty Points Discount ({appliedLoyaltyPoints.points} pts)</span>
              <span>-₹{appliedLoyaltyPoints.discountAmount.toLocaleString("en-IN")}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
            <span className="text-foreground">Estimated Total{gstExtra ? " (+ GST)" : ""}</span>
            <span className="font-display text-lg text-primary">
              ₹{(finalPrice || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      {coveredByPlan && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Service covered by your active plan membership visits</span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
        By requesting this service, CWP will assign a trained technician and confirm your booking.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
      <span className="text-muted-foreground text-xs font-medium shrink-0">{label}</span>
      <span className="font-medium text-foreground text-right truncate text-xs sm:text-sm">{value}</span>
    </div>
  );
}
