import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";

const LOCATION_LABELS = ["Home", "Office", "Factory", "Solar Site", "Other"];

interface Props {
  value: LocationValue | null;
  onChange: (loc: LocationValue) => void;
  savedLocations?: SavedLocation[];
  onSaveNew?: (label: string, loc: LocationValue) => void;
  required?: boolean;
  className?: string;
}

export function LocationPicker({ value, onChange, savedLocations, onSaveNew, required, className }: Props) {
  const [mode, setMode] = useState<"saved" | "new">(savedLocations?.length ? "saved" : "new");
  const [selectedSaved, setSelectedSaved] = useState("");
  const [address, setAddress] = useState(value?.address ?? "");
  const [lat, setLat] = useState(value?.latitude?.toString() ?? "");
  const [lng, setLng] = useState(value?.longitude?.toString() ?? "");
  const [placeId, setPlaceId] = useState(value?.placeId ?? "");
  const [newLabel, setNewLabel] = useState("Home");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (value) {
      setAddress(value.address);
      setLat(value.latitude.toString());
      setLng(value.longitude.toString());
      setPlaceId(value.placeId ?? "");
    }
  }, [value]);

  const emitChange = (a: string, la: string, ln: string, pid?: string) => {
    const latitude = parseFloat(la);
    const longitude = parseFloat(ln);
    if (a && !isNaN(latitude) && !isNaN(longitude)) {
      onChange({ address: a, latitude, longitude, placeId: pid });
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        emitChange(address, pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6), placeId);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSavedSelect = (id: string) => {
    setSelectedSaved(id);
    const loc = savedLocations?.find(l => String(l.id) === id);
    if (loc) {
      setAddress(loc.address);
      setLat(loc.latitude.toString());
      setLng(loc.longitude.toString());
      setPlaceId(loc.placeId ?? "");
      onChange({ address: loc.address, latitude: loc.latitude, longitude: loc.longitude, placeId: loc.placeId });
    }
  };

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-primary shrink-0" />
        <Label className="font-semibold text-sm">
          Service Location {required && <span className="text-destructive">*</span>}
        </Label>
      </div>

      {savedLocations && savedLocations.length > 0 && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === "saved" ? "default" : "outline"} onClick={() => setMode("saved")}>
            Saved Location
          </Button>
          <Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
            New Location
          </Button>
        </div>
      )}

      {mode === "saved" && savedLocations && savedLocations.length > 0 ? (
        <Select value={selectedSaved} onValueChange={handleSavedSelect}>
          <SelectTrigger data-testid="select-saved-location">
            <SelectValue placeholder="Choose a saved location" />
          </SelectTrigger>
          <SelectContent>
            {savedLocations.map(loc => (
              <SelectItem key={loc.id} value={String(loc.id)}>
                {loc.label} — {loc.address.slice(0, 40)}{loc.address.length > 40 ? "…" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <div>
            <Label>Address</Label>
            <Input
              className="mt-1"
              value={address}
              onChange={e => { setAddress(e.target.value); emitChange(e.target.value, lat, lng, placeId); }}
              placeholder="Full address with landmark"
              data-testid="input-location-address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input className="mt-1" value={lat} onChange={e => { setLat(e.target.value); emitChange(address, e.target.value, lng, placeId); }} data-testid="input-location-lat" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input className="mt-1" value={lng} onChange={e => { setLng(e.target.value); emitChange(address, lat, e.target.value, placeId); }} data-testid="input-location-lng" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Google Place ID (optional)</Label>
            <Input className="mt-1" value={placeId} onChange={e => { setPlaceId(e.target.value); emitChange(address, lat, lng, e.target.value); }} placeholder="ChIJ..." />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} disabled={locating} className="gap-1.5">
            {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
            Use current location
          </Button>
          {onSaveNew && address && lat && lng && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onSaveNew(newLabel, { address, latitude: parseFloat(lat), longitude: parseFloat(lng), placeId })}
            >
              Save this location
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
