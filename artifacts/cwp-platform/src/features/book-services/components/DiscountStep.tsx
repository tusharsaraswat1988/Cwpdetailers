import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BookServicesDraft } from "../types";

type Props = {
  discountType: BookServicesDraft["discountType"];
  discountValue: string;
  onChange: (patch: Pick<BookServicesDraft, "discountType" | "discountValue">) => void;
};

export function DiscountStep({ discountType, discountValue, onChange }: Props) {
  return (
    <div className="space-y-4" data-testid="book-step-discount">
      <div>
        <Label>Discount (optional)</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Apply a one-time discount for this quote. This is for display only until booking is confirmed in a later step.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Discount type</Label>
          <Select
            value={discountType}
            onValueChange={v => onChange({
              discountType: v as BookServicesDraft["discountType"],
              discountValue: v === "none" ? "" : discountValue,
            })}
          >
            <SelectTrigger className="mt-1" data-testid="book-discount-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No discount</SelectItem>
              <SelectItem value="percent">Percentage off</SelectItem>
              <SelectItem value="flat">Fixed amount off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {discountType !== "none" && (
          <div>
            <Label className="text-xs text-muted-foreground">
              {discountType === "percent" ? "Percent off" : "Amount off (₹)"}
            </Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={discountType === "percent" ? 100 : undefined}
              value={discountValue}
              onChange={e => onChange({ discountType, discountValue: e.target.value })}
              data-testid="book-discount-value"
              placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 500"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
