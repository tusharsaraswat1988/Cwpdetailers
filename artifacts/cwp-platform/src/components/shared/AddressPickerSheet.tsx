import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoogleMapPicker } from "@/components/shared/GoogleMapPicker";
import { isGoogleMapsConfigured } from "@/lib/maps";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import { Check, Loader2, MapPin, Navigation, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const LOCATION_LABELS = ["Home", "Office", "Factory", "Solar Site", "Other"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: LocationValue | null;
  onSelect: (loc: LocationValue) => void;
  savedLocations?: SavedLocation[];
  onSaveNew?: (label: string, loc: LocationValue) => void;
};

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
  const [draft, setDraft] = useState<LocationValue | null>(value);
  const [newLabel, setNewLabel] = useState("Home");
  const [manualAddress, setManualAddress] = useState(value?.address ?? "");
  const [manualLat, setManualLat] = useState(value?.latitude?.toString() ?? "");
  const [manualLng, setManualLng] = useState(value?.longitude?.toString() ?? "");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setManualAddress(value?.address ?? "");
    setManualLat(value?.latitude?.toString() ?? "");
    setManualLng(value?.longitude?.toString() ?? "");
    setMode(savedLocations && savedLocations.length > 0 ? "list" : "new");
  }, [open, value, savedLocations]);

  const confirmDraft = () => {
    if (!draft) return;
    onSelect(draft);
    if (onSaveNew && mode === "new") {
      onSaveNew(newLabel, draft);
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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const address = manualAddress.trim() || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        const next = { address, latitude, longitude };
        setDraft(next);
        setManualLat(latitude.toFixed(6));
        setManualLng(longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const applyManual = () => {
    const latitude = parseFloat(manualLat);
    const longitude = parseFloat(manualLng);
    if (!manualAddress.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    setDraft({ address: manualAddress.trim(), latitude, longitude });
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
            className="gap-1"
          >
            <Plus size={14} /> New address
          </Button>
        </div>
      )}

      {mode === "list" && savedLocations && savedLocations.length > 0 ? (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {savedLocations.map(loc => {
            const selected =
              value &&
              Math.abs(value.latitude - loc.latitude) < 1e-6 &&
              Math.abs(value.longitude - loc.longitude) < 1e-6;
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
                  <p className="text-sm font-medium">{loc.label}{loc.isDefault ? " · Default" : ""}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{loc.address}</p>
                </div>
                {selected && <Check size={16} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {onSaveNew && (
            <div>
              <Label className="text-xs text-muted-foreground">Save as</Label>
              <Select value={newLabel} onValueChange={setNewLabel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCATION_LABELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {mapsEnabled ? (
            <GoogleMapPicker
              value={draft}
              onChange={setDraft}
              mapHeightClass="h-40"
            />
          ) : (
            <>
              <div>
                <Label>Address</Label>
                <Input
                  className="mt-1"
                  value={manualAddress}
                  onChange={e => {
                    setManualAddress(e.target.value);
                    const latitude = parseFloat(manualLat);
                    const longitude = parseFloat(manualLng);
                    if (e.target.value.trim() && Number.isFinite(latitude) && Number.isFinite(longitude)) {
                      setDraft({ address: e.target.value.trim(), latitude, longitude });
                    }
                  }}
                  placeholder="Full address with landmark"
                  data-testid="input-location-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Latitude</Label>
                  <Input
                    className="mt-1"
                    value={manualLat}
                    onChange={e => setManualLat(e.target.value)}
                    onBlur={applyManual}
                    data-testid="input-location-lat"
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    className="mt-1"
                    value={manualLng}
                    onChange={e => setManualLng(e.target.value)}
                    onBlur={applyManual}
                    data-testid="input-location-lng"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useCurrentLocation}
                disabled={locating}
                className="gap-1.5"
              >
                {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                Use current location
              </Button>
            </>
          )}

          <Button
            type="button"
            className="w-full h-11"
            disabled={!draft}
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" data-testid="address-picker-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Where should we arrive?</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
