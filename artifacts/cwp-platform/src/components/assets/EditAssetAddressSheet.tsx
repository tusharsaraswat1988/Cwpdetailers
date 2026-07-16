import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/shared/LocationPicker";
import type { AssetCardModel } from "@/lib/asset-dashboard";
import type { LocationValue } from "@/features/master-data/api";

interface EditAssetAddressSheetProps {
  asset: AssetCardModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation: LocationValue | null;
  onSave: (asset: AssetCardModel, location: LocationValue) => void;
  saving?: boolean;
}

export function EditAssetAddressSheet({
  asset,
  open,
  onOpenChange,
  initialLocation,
  onSave,
  saving,
}: EditAssetAddressSheetProps) {
  const isMobile = useIsMobile();
  const [location, setLocation] = useState<LocationValue | null>(initialLocation);

  useEffect(() => {
    if (open) setLocation(initialLocation);
  }, [open, initialLocation]);

  const title = asset
    ? `Edit ${asset.kind === "vehicle" ? "vehicle" : "solar site"} address`
    : "Edit address";

  const body = (
    <div className="space-y-4 pb-2">
      {asset && (
        <p className="text-sm text-muted-foreground">
          {asset.name}{asset.subtitle ? ` · ${asset.subtitle}` : ""}
        </p>
      )}
      <LocationPicker value={location} onChange={setLocation} required />
      <Button
        className="w-full h-11"
        disabled={!location || saving}
        onClick={() => asset && location && onSave(asset, location)}
        data-testid="btn-save-asset-address"
      >
        {saving ? "Saving…" : "Save address"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-6 pt-4 max-h-[92dvh] overflow-y-auto">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="font-display">{title}</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

export default EditAssetAddressSheet;
