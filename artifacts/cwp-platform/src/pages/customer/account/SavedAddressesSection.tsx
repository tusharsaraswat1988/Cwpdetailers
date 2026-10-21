import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSavedLocations,
  useCreateSavedLocation,
  useUpdateSavedLocation,
  useDeleteSavedLocation,
  useSetDefaultSavedLocation,
  type SavedLocation,
  type SavedLocationWrite,
} from "@/features/master-data/api";
import { mapsViewUrl, isValidMapCoordinate } from "@/lib/maps";
import { useToast } from "@/hooks/use-toast";
import { AccountSection, AccountRow } from "./AccountSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  Plus,
  ExternalLink,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LABEL_PRESETS = ["Home", "Office", "Apartment", "Villa", "Farmhouse", "Other"];

interface Props {
  customerId?: number | null;
}

export function SavedAddressesSection({ customerId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: locations = [], isLoading } = useSavedLocations(customerId ?? undefined);
  const createMutation = useCreateSavedLocation();
  const updateMutation = useUpdateSavedLocation();
  const deleteMutation = useDeleteSavedLocation();
  const setDefaultMutation = useSetDefaultSavedLocation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<SavedLocation | null>(null);

  // Form State
  const [label, setLabel] = useState("Home");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coordsPasted, setCoordsPasted] = useState("");

  const resetForm = () => {
    setEditingLoc(null);
    setLabel("Home");
    setAddress("");
    setCity("");
    setPincode("");
    setLat("");
    setLng("");
    setIsDefault(false);
    setCoordsPasted("");
  };

  const openNew = () => {
    resetForm();
    if (locations.length === 0) setIsDefault(true);
    setModalOpen(true);
  };

  const openEdit = (loc: SavedLocation) => {
    setEditingLoc(loc);
    setLabel(loc.label);
    setAddress(loc.address);
    setCity(loc.cityName ?? loc.city ?? "");
    setPincode(loc.pincode ?? "");
    setLat(loc.latitude != null ? String(loc.latitude) : "");
    setLng(loc.longitude != null ? String(loc.longitude) : "");
    setIsDefault(Boolean(loc.isDefault));
    setCoordsPasted("");
    setModalOpen(true);
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported on this device", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast({ title: "GPS coordinates detected!" });
      },
      err => {
        setLocating(false);
        toast({ title: "Could not detect GPS location", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const parsePastedCoords = (input: string) => {
    setCoordsPasted(input);
    const trimmed = input.trim();
    if (!trimmed) return;

    // Pattern 1: "@lat,lng" or "q=lat,lng" or "ll=lat,lng" from Google Maps URL
    const urlMatch = trimmed.match(/[@?&](?:q=|ll=|query=)?(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (urlMatch) {
      const parsedLat = parseFloat(urlMatch[1]);
      const parsedLng = parseFloat(urlMatch[2]);
      if (isValidMapCoordinate(parsedLat, parsedLng)) {
        setLat(parsedLat.toFixed(6));
        setLng(parsedLng.toFixed(6));
        toast({ title: "Extracted coordinates from Google Maps link!" });
        return;
      }
    }

    // Pattern 2: "lat, lng" e.g. "25.3176, 82.9739"
    const coordMatch = trimmed.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (coordMatch) {
      const parsedLat = parseFloat(coordMatch[1]);
      const parsedLng = parseFloat(coordMatch[2]);
      if (isValidMapCoordinate(parsedLat, parsedLng)) {
        setLat(parsedLat.toFixed(6));
        setLng(parsedLng.toFixed(6));
        toast({ title: "Coordinates extracted!" });
        return;
      }
    }
  };

  const handleSave = async () => {
    if (!customerId) return;
    if (!address.trim()) {
      toast({ title: "Please enter an address", variant: "destructive" });
      return;
    }

    const parsedLat = lat ? parseFloat(lat) : null;
    const parsedLng = lng ? parseFloat(lng) : null;

    const payload: SavedLocationWrite = {
      customerId,
      label: label.trim() || "Home",
      address: address.trim(),
      cityName: city.trim() || undefined,
      pincode: pincode.trim() || undefined,
      latitude: parsedLat != null && Number.isFinite(parsedLat) ? parsedLat : null,
      longitude: parsedLng != null && Number.isFinite(parsedLng) ? parsedLng : null,
      isDefault,
    };

    try {
      if (editingLoc) {
        await updateMutation.mutateAsync({
          id: editingLoc.id,
          ...payload,
        });
        toast({ title: "Address updated successfully" });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Address saved successfully" });
      }
      setModalOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: "Failed to save address", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (loc: SavedLocation) => {
    if (!customerId) return;
    if (!window.confirm(`Delete address "${loc.label}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: loc.id, customerId });
      toast({ title: "Address removed" });
    } catch (e) {
      toast({ title: "Failed to delete address", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSetDefault = async (loc: SavedLocation) => {
    if (!customerId) return;
    try {
      await setDefaultMutation.mutateAsync({ id: loc.id, customerId });
      toast({ title: `"${loc.label}" set as default address` });
    } catch (e) {
      toast({ title: "Failed to update default address", description: (e as Error).message, variant: "destructive" });
    }
  };

  const parsedLatNum = lat ? parseFloat(lat) : NaN;
  const parsedLngNum = lng ? parseFloat(lng) : NaN;
  const hasValidFormCoords = isValidMapCoordinate(parsedLatNum, parsedLngNum);

  return (
    <>
      <AccountSection title="Saved Addresses" testId="saved-addresses-section">
        {isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading addresses…</div>
        ) : locations.length === 0 ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              No saved addresses found. Add an address with GPS coordinates so our service staff can navigate directly to you for car cleaning or solar wash.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={openNew}
              className="gap-1.5 h-9 rounded-xl font-medium"
              data-testid="add-first-address-btn"
            >
              <Plus size={14} /> Add My First Address
            </Button>
          </div>
        ) : (
          <>
            {locations.map(loc => {
              const hasGps = loc.latitude != null && loc.longitude != null && isValidMapCoordinate(loc.latitude, loc.longitude);
              return (
                <div key={loc.id} className="p-4 space-y-2.5 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{loc.label}</span>
                        {loc.isDefault && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                            Default
                          </Badge>
                        )}
                        {hasGps ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                            <CheckCircle2 size={11} /> GPS Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            <AlertTriangle size={11} /> No GPS coordinates
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {loc.address}
                        {loc.cityName ? `, ${loc.cityName}` : loc.city ? `, ${loc.city}` : ""}
                        {loc.pincode ? ` - ${loc.pincode}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(loc)}
                        title="Edit address"
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(loc)}
                        title="Delete address"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                    <div>
                      {hasGps ? (
                        <a
                          href={mapsViewUrl(loc.latitude!, loc.longitude!)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
                        >
                          <Navigation size={11} /> View on Google Maps
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEdit(loc)}
                          className="text-amber-700 hover:underline text-[11px] font-medium"
                        >
                          + Add GPS pin for staff directions
                        </button>
                      )}
                    </div>

                    {!loc.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(loc)}
                        className="text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors"
                      >
                        Make Default
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="p-3 bg-muted/20 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openNew}
                className="gap-1.5 h-8 text-xs rounded-lg font-medium"
                data-testid="add-another-address-btn"
              >
                <Plus size={13} /> Add Another Address
              </Button>
            </div>
          </>
        )}
      </AccountSection>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              {editingLoc ? `Edit Address (${editingLoc.label})` : "Add Service Address"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Label Preset Selection */}
            <div>
              <Label className="text-xs font-semibold">Address Label *</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {LABEL_PRESETS.map(p => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={label === p ? "default" : "outline"}
                    className="h-7 px-2.5 text-xs rounded-full"
                    onClick={() => setLabel(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Address Text */}
            <div>
              <Label className="text-xs font-semibold">Address Details *</Label>
              <Input
                className="mt-1"
                placeholder="House / Flat No., Society / Landmark, Road"
                value={address}
                onChange={e => setAddress(e.target.value)}
                data-testid="input-saved-address"
              />
            </div>

            {/* City & Pincode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">City</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Varanasi"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Pincode</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. 221005"
                  value={pincode}
                  onChange={e => setPincode(e.target.value)}
                />
              </div>
            </div>

            {/* GPS Coordinates Section */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-primary flex items-center gap-1.5">
                  <Navigation size={13} /> GPS Coordinates (for Staff Turn-by-turn Navigation)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 bg-background"
                  onClick={handleDetectGPS}
                  disabled={locating}
                >
                  {locating ? <Loader2 size={11} className="animate-spin" /> : <Navigation size={11} />}
                  Detect My GPS
                </Button>
              </div>

              {/* Paste helper */}
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Paste Google Maps link or coordinates (e.g. 25.3176, 82.9739)
                </Label>
                <Input
                  className="mt-1 h-8 text-xs bg-background"
                  placeholder="Paste map link / coordinates here…"
                  value={coordsPasted}
                  onChange={e => parsePastedCoords(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Latitude</Label>
                  <Input
                    className="mt-1 h-8 text-xs bg-background font-mono"
                    placeholder="e.g. 25.317600"
                    value={lat}
                    onChange={e => setLat(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Longitude</Label>
                  <Input
                    className="mt-1 h-8 text-xs bg-background font-mono"
                    placeholder="e.g. 82.973900"
                    value={lng}
                    onChange={e => setLng(e.target.value)}
                  />
                </div>
              </div>

              {hasValidFormCoords ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle2 size={11} /> Coordinates valid
                  </span>
                  <a
                    href={mapsViewUrl(parsedLatNum, parsedLngNum)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> Preview in Google Maps
                  </a>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Tap &quot;Detect My GPS&quot; while standing at this address, or copy-paste the pin from Google Maps.
                </p>
              )}
            </div>

            {/* Default Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="default-address-cb"
                checked={isDefault}
                onCheckedChange={c => setIsDefault(Boolean(c))}
              />
              <Label htmlFor="default-address-cb" className="text-xs cursor-pointer font-normal">
                Set as my default service address
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Saving…</>
              ) : (
                "Save Address"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
