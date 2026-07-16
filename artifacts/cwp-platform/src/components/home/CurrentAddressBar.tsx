import { useState } from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import type { SelectedAddress } from "@/lib/selected-address";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
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
  className?: string;
}

export function CurrentAddressBar({
  address,
  selected,
  savedLocations,
  onSelectAddress,
  className,
}: CurrentAddressBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2.5 min-h-[2.5rem]",
          address.complete ? "border-border bg-card" : "border-amber-500/30 bg-amber-500/5",
          className,
        )}
        data-testid="home-current-address"
      >
        <MapPin size={15} className={cn("shrink-0", address.complete ? "text-primary" : "text-amber-600")} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current address
          </p>
          <p className="text-sm font-medium truncate leading-tight">
            {address.line}
            {address.assetLabel && (
              <span className="text-muted-foreground font-normal"> · {address.assetLabel}</span>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 px-2 text-primary font-medium"
          onClick={() => setOpen(true)}
          data-testid="home-change-address"
          aria-label="Change current service address"
        >
          Change
        </Button>
      </div>

      <AddressPickerSheet
        open={open}
        onOpenChange={setOpen}
        value={selected}
        onSelect={loc => onSelectAddress(loc)}
        savedLocations={savedLocations}
      />

      {!address.complete && (
        <Link href={CUSTOMER_ROUTES.assets} className="sr-only">
          Add asset to set service address
        </Link>
      )}
    </>
  );
}

export default CurrentAddressBar;
