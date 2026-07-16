import { ServiceAddressRow } from "@/components/shared/ServiceAddressRow";
import { Label } from "@/components/ui/label";
import type { LocationValue } from "@/features/master-data/api";
import type { CustomerPlan } from "@/lib/customer-plans";
import type { ScheduleAsset, PlanMode } from "@/lib/schedule-journey";
import { formatDateLabel } from "@/lib/schedule-slots";

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
}: ScheduleReviewStepProps) {
  return (
    <div className="space-y-4" data-testid="schedule-step-review">
      <div className="rounded-xl border border-border bg-card divide-y divide-border text-sm">
        <Row label="Asset" value={`${asset.name}${asset.subtitle ? ` · ${asset.subtitle}` : ""}`} />
        <div className="p-3">
          <ServiceAddressRow value={address} onChangeClick={onChangeAddress} label="Address" />
        </div>
        <Row label="Plan" value={planMode === "plan" && plan ? plan.name : "One-Time Visit"} />
        <Row label="Service" value={serviceName} />
        <Row label="Date" value={`${formatDateLabel(date)} (${date})`} />
        <Row label="Time" value={time} />
      </div>

      <div>
        <Label htmlFor="schedule-notes">Special instructions (optional)</Label>
        <textarea
          id="schedule-notes"
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Gate code, parking tip, etc."
          className="mt-1 flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="schedule-notes"
        />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        By requesting this service, you agree that CWP will verify availability and confirm your scheduled service.
      </p>

      {estimatedPrice != null && !coveredByPlan && (
        <div className="rounded-lg bg-muted/50 px-4 py-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Estimated price</span>
          <span className="font-semibold text-primary">₹{estimatedPrice.toLocaleString("en-IN")}</span>
        </div>
      )}
      {coveredByPlan && (
        <p className="text-xs text-green-700">Service covered by your active plan</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}

export default ScheduleReviewStep;
