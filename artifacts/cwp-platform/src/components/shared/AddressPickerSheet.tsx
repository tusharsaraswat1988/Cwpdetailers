import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FormattedAddressDisplay } from "@/components/shared/FormattedAddressDisplay";
import {
  CustomerServiceAddressSection,
  type CustomerServiceAddressValue,
} from "@/features/customers/components/CustomerServiceAddressSection";
import {
  composeSavedAddress,
  hasRequiredAddressParts,
  parseComposedAddress,
} from "@/features/customers/lib/serviceAddress";
import { isGoogleMapsConfigured } from "@/lib/maps";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import { Check, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: LocationValue | null;
  onSelect: (loc: LocationValue) => void;
  savedLocations?: SavedLocation[];
  onSaveNew?: (label: string, loc: LocationValue) => void;
};

function emptyAddressValue(label = "Home"): CustomerServiceAddressValue {
  return {
    serviceLocationLabel: label,
    houseNumber: "",
    buildingName: "",
    area: "",
    landmark: "",
    pincode: "",
    city: "",
    latitude: "",
    longitude: "",
    placeId: "",
  };
}

function locationToAddressForm(loc: LocationValue | null, label: string): CustomerServiceAddressValue {
  if (!loc) return emptyAddressValue(label);
  const parts = parseComposedAddress(loc.address);
  return {
    serviceLocationLabel: label,
    houseNumber: parts.houseNumber,
    buildingName: parts.buildingName,
    area: parts.area,
    landmark: parts.landmark,
    pincode: parts.pincode,
    city: parts.city,
    latitude: Number.isFinite(loc.latitude) ? String(loc.latitude) : "",
    longitude: Number.isFinite(loc.longitude) ? String(loc.longitude) : "",
    placeId: loc.placeId ?? "",
  };
}

function addressFormToLocation(form: CustomerServiceAddressValue): LocationValue | null {
  if (!hasRequiredAddressParts(form)) return null;
  const lat = parseFloat(form.latitude);
  const lng = parseFloat(form.longitude);
  const mapsEnabled = isGoogleMapsConfigured();
  if (mapsEnabled && (!Number.isFinite(lat) || !Number.isFinite(lng))) return null;

  return {
    address: composeSavedAddress(form),
    latitude: Number.isFinite(lat) ? lat : 0,
    longitude: Number.isFinite(lng) ? lng : 0,
    placeId: form.placeId.trim() || undefined,
  };
}

export function AddressPickerSheet({
  open,
  onOpenChange,
  value,
  onSelect,
  savedLocations,
  onSaveNew,
}: Props) {
  const isMobile = useIsMobile();
  const mapsEnabled = isGoogleMapsConfigured();
  const [mode, setMode] = useState<"list" | "new">(
    savedLocations && savedLocations.length > 0 ? "list" : "new",
  );
  const [addressForm, setAddressForm] = useState<CustomerServiceAddressValue>(() =>
    locationToAddressForm(value, "Home"),
  );

  useEffect(() => {
    if (!open) return;
    setAddressForm(locationToAddressForm(value, "Home"));
    setMode(savedLocations && savedLocations.length > 0 ? "list" : "new");
  }, [open, value, savedLocations]);

  const draft = addressFormToLocation(addressForm);
  const dispatchReady = Boolean(draft) && (
    !mapsEnabled
    || (addressForm.latitude.trim() && addressForm.longitude.trim())
  );

  const confirmDraft = () => {
    if (!draft) return;
    onSelect(draft);
    if (onSaveNew && mode === "new") {
      onSaveNew(addressForm.serviceLocationLabel.trim() || "Home", draft);
    }
    onOpenChange(false);
  };

  const selectSaved = (loc: SavedLocation) => {
    const next: LocationValue = {
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      placeId: loc.placeId,
    };
    onSelect(next);
    onOpenChange(false);
  };

  const body = (
    <div className="space-y-4 pb-2">
      {savedLocations && savedLocations.length > 0 && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "list" ? "default" : "outline"}
            onClick={() => setMode("list")}
          >
            Saved
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => setMode("new")}
          >
            New address
          </Button>
        </div>
      )}

      {mode === "list" && savedLocations && savedLocations.length > 0 ? (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {savedLocations.map(loc => {
            const selected =
              value
              && Math.abs(value.latitude - loc.latitude) < 1e-6
              && Math.abs(value.longitude - loc.longitude) < 1e-6;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => selectSaved(loc)}
                className={cn(
                  "w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                )}
                data-testid={`saved-location-${loc.id}`}
              >
                <MapPin size={16} className="shrink-0 text-primary mt-0.5" />
                <div className="min-w-0 flex-1">
                  <FormattedAddressDisplay
                    value={loc.address}
                    siteLabel={loc.label}
                    compact
                  />
                </div>
                {selected && <Check size={16} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <CustomerServiceAddressSection
            idPrefix="address-picker"
            value={addressForm}
            onChange={patch => setAddressForm(prev => ({ ...prev, ...patch }))}
          />

          <Button
            type="button"
            className="w-full h-11"
            disabled={!dispatchReady}
            onClick={confirmDraft}
            data-testid="btn-confirm-address"
          >
            Use this address
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-5 pb-6 pt-4 max-h-[92dvh] overflow-y-auto"
          data-testid="address-picker-sheet"
        >
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="font-display">Where should we arrive?</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="address-picker-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Where should we arrive?</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
