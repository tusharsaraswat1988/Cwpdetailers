import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeatCategories, type SeatCategory, type VehicleModel } from "@/features/master-data/api";
import { cn } from "@/lib/utils";

type Props = {
  value: number | null;
  onChange: (seatCategoryId: number | null) => void;
  /** When model is selected, its default seat is highlighted in the helper text. */
  model?: VehicleModel | null;
  required?: boolean;
  className?: string;
  id?: string;
};

/**
 * Seating picker for vehicles that share a model across 5 / 7 seater (etc.).
 * Pricing uses this override when set; otherwise falls back to the model default.
 */
export function SeatCategorySelect({
  value,
  onChange,
  model,
  required = true,
  className,
  id = "seat-category",
}: Props) {
  const { data: seats, isLoading } = useSeatCategories();
  const active = (seats ?? []).filter(s => s.isActive !== false);

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>Seater{required ? " *" : ""}</Label>
      <Select
        value={value != null ? String(value) : "none"}
        onValueChange={v => onChange(v === "none" ? null : parseInt(v, 10))}
        disabled={isLoading || active.length === 0}
      >
        <SelectTrigger id={id} className="mt-1" data-testid="select-seat-category">
          <SelectValue placeholder={isLoading ? "Loading…" : "Select seating"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" disabled>Select seating</SelectItem>
          {active.map((s: SeatCategory) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
              {s.seatCount ? ` (${s.seatCount})` : ""}
              {model?.seatCategoryId === s.id ? " · model default" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        Wash rates depend on seating (e.g. 5 vs 5+). Pick the actual configuration of this car.
      </p>
    </div>
  );
}
