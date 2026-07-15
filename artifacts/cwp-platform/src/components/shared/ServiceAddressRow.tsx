import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocationValue } from "@/features/master-data/api";

type Props = {
  value: LocationValue | null;
  onChangeClick: () => void;
  label?: string;
  emptyHint?: string;
  className?: string;
};

/** Compact address chip — map lives only in AddressPickerSheet. */
export function ServiceAddressRow({
  value,
  onChangeClick,
  label = "Service address",
  emptyHint = "Add where we should arrive",
  className,
}: Props) {
  return (
    <div className={cn("space-y-1.5", className)} data-testid="service-address-row">
      <p className="text-sm font-semibold">{label}</p>
      <button
        type="button"
        onClick={onChangeClick}
        className={cn(
          "w-full flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
          value
            ? "border-border bg-card hover:border-primary/40"
            : "border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10",
        )}
        data-testid="btn-change-address"
      >
        <MapPin size={18} className="shrink-0 text-primary mt-0.5" />
        <div className="min-w-0 flex-1">
          {value ? (
            <>
              <p className="text-sm font-medium leading-snug line-clamp-2">{value.address}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tap to change</p>
            </>
          ) : (
            <p className="text-sm font-medium text-primary">{emptyHint}</p>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 h-8 px-2 text-primary" tabIndex={-1}>
          {value ? "Change" : "Add"}
        </Button>
      </button>
    </div>
  );
}
