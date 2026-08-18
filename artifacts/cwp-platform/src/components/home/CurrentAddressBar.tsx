import { useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import type { SelectedAddress } from "@/lib/selected-address";
import { cn } from "@/lib/utils";

interface CurrentAddressBarProps {
  address: {
    line: string;
    assetLabel?: string;
    complete: boolean;
  };
  selected: SelectedAddress | null;
  savedLocations?: SavedLocation[];
  onSelectAddress: (loc: LocationValue, meta?: Pick<SelectedAddress, "assetId" | "assetType" | "assetLabel">) => void;
  onSaveNew?: (label: string, loc: LocationValue) => void;
  className?: string;
}

export function CurrentAddressBar({
  address,
  selected,
  savedLocations,
  onSelectAddress,
  onSaveNew,
  className,
}: CurrentAddressBarProps) {
  const [open, setOpen] = useState(false);
  const hasAddress = Boolean(selected?.address?.trim());

  return (
    <>
      <button
        type="button"
        className={cn(
          "customer-card flex items-center gap-2.5 px-3.5 py-3 min-h-12 w-full text-left",
          hasAddress
            ? address.complete ? "customer-elevated" : "border-amber-500/30 bg-amber-500/5"
            : "border-dashed border-border",
          className,
        )}
        data-testid="home-current-address"
        onClick={() => setOpen(true)}
        aria-label={hasAddress ? "Change service address" : "Add service address"}
      >
        <MapPin
          size={18}
          className={cn(
            "shrink-0",
            hasAddress ? (address.complete ? "text-primary" : "text-amber-600") : "text-muted-foreground",
          )}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {hasAddress ? "Service at" : "Location"}
          </p>
          <p className={cn("text-sm truncate leading-tight", hasAddress ? "font-semibold" : "font-medium text-muted-foreground")}>
            {address.line}
          </p>
          {hasAddress && address.assetLabel && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{address.assetLabel}</p>
          )}
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-0.5 h-10 px-2.5 text-sm font-medium text-primary"
          data-testid="home-change-address"
        >
          {hasAddress ? "Change" : "Add"}
          <ChevronRight size={14} aria-hidden />
        </span>
      </button>

      <AddressPickerSheet
        open={open}
        onOpenChange={setOpen}
        value={selected}
        onSelect={(loc, meta) => onSelectAddress(loc, meta)}
        savedLocations={savedLocations}
        onSaveNew={onSaveNew}
      />
    </>
  );
}

export default CurrentAddressBar;
