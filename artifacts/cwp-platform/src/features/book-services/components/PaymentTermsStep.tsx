import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { PaymentTermsChoice } from "../types";
import { paymentTermsLabel } from "../types";
import { cn } from "@/lib/utils";

const OPTIONS: PaymentTermsChoice[] = ["full_advance", "partial_advance", "after_service"];

type Props = {
  paymentTerms: PaymentTermsChoice;
  partialAdvancePercent: string;
  onChange: (patch: { paymentTerms: PaymentTermsChoice; partialAdvancePercent?: string }) => void;
};

export function PaymentTermsStep({ paymentTerms, partialAdvancePercent, onChange }: Props) {
  return (
    <div className="space-y-4" data-testid="book-step-payment">
      <div>
        <Label>How will the customer pay?</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose payment timing for this sale. Required for every booking.
        </p>
      </div>
      <div className="grid gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange({ paymentTerms: opt })}
            data-testid={`book-payment-${opt}`}
            className={cn(
              "text-left border rounded-lg px-4 py-3 text-sm transition-colors",
              paymentTerms === opt ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/40",
            )}
          >
            {paymentTermsLabel(opt)}
          </button>
        ))}
      </div>
      {paymentTerms === "partial_advance" && (
        <div className="max-w-xs">
          <Label>Advance percentage</Label>
          <Input
            type="number"
            min={1}
            max={99}
            className="mt-1"
            value={partialAdvancePercent}
            onChange={e => onChange({ paymentTerms, partialAdvancePercent: e.target.value })}
            data-testid="book-partial-percent"
          />
          <p className="text-xs text-muted-foreground mt-1">Customer pays this share before work starts.</p>
        </div>
      )}
    </div>
  );
}
