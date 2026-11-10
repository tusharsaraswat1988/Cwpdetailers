import { ServiceAddressRow } from "@/components/shared/ServiceAddressRow";
import { Label } from "@/components/ui/label";
import type { LocationValue } from "@/features/master-data/api";
import type { CustomerPlan } from "@/lib/customer-plans";
import type { ScheduleAsset, PlanMode } from "@/lib/schedule-journey";
import { formatDateLabel } from "@/lib/schedule-slots";
import { CheckCircle2 } from "lucide-react";

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
}: ScheduleReviewStepProps) {
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
          onChange={e => onNotesChange(e.target.value)}
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

      {estimatedPrice != null && !coveredByPlan && !siteVisitRequired && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 flex justify-between items-center text-sm">
          <span className="text-muted-foreground font-medium">Estimated price{gstExtra ? " (+ GST)" : ""}</span>
          <span className="font-display font-bold text-lg text-primary">₹{estimatedPrice.toLocaleString("en-IN")}</span>
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
    <div className="flex justify-between items-center gap-3 px-3.5 py-3 sm:px-4">
      <span className="text-xs text-muted-foreground font-medium shrink-0">{label}</span>
      <span className="font-semibold text-foreground text-right truncate text-xs sm:text-sm">{value}</span>
    </div>
  );
}

export default ScheduleReviewStep;
