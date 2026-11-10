import { useState } from "react";
import { ServiceAddressSelector } from "./ServiceAddressSelector";
import { HomeGreeting } from "./HomeGreeting";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";
import type { LocationValue, SavedLocation, SavedLocationWrite } from "@/features/master-data/api";
import type { SelectedAddress } from "@/lib/selected-address";
import { cn } from "@/lib/utils";

interface HomeHeaderProps {
  customerName?: string;
  address: {
    line: string;
    assetLabel?: string;
    complete: boolean;
  };
  selected: SelectedAddress | null;
  savedLocations?: SavedLocation[];
  customerId?: number;
  onSelectAddress: (loc: LocationValue, meta?: Pick<SelectedAddress, "assetId" | "assetType" | "assetLabel">) => void;
  onSaveNew?: (data: SavedLocationWrite) => Promise<SavedLocation> | SavedLocation | void;
  onUpdate?: (id: number, data: SavedLocationWrite) => Promise<SavedLocation> | SavedLocation | void;
  onDelete?: (id: number) => Promise<void> | void;
  onSetDefault?: (id: number) => Promise<SavedLocation> | SavedLocation | void;
  className?: string;
}

export function HomeHeader({
  customerName,
  address,
  selected,
  savedLocations,
  customerId,
  onSelectAddress,
  onSaveNew,
  onUpdate,
  onDelete,
  onSetDefault,
  className,
}: HomeHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div className={cn("space-y-4 pb-1", className)} data-testid="home-header">
        {/* 1. Service Address Selector (Immediately below application header) */}
        <ServiceAddressSelector
          selected={selected}
          address={address}
          onClick={() => setPickerOpen(true)}
        />

        {/* 2. Personalized Greeting */}
        <HomeGreeting customerName={customerName} />
      </div>

      <AddressPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={selected}
        savedLocations={savedLocations}
        customerId={customerId}
        onSelect={(loc: LocationValue, meta?: { assetLabel?: string }) => {
          onSelectAddress(loc, meta ? { assetLabel: meta.assetLabel } : undefined);
          setPickerOpen(false);
        }}
        onSaveNew={onSaveNew}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onSetDefault={onSetDefault}
      />
    </>
  );
}

export default HomeHeader;
