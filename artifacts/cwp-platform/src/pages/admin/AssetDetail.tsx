import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Car,
  Sun,
  History,
  MapPin,
  Pencil,
  Navigation,
  Compass,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  getAsset,
  updateAsset,
  transferAssetCustomer,
  transferAssetLocation,
  ASSET_TYPE_LABELS,
} from "@/features/assets/api";
import { listServiceLocations } from "@/features/service-locations/api";
import { StaffAssignSelect } from "@/components/shared/StaffAssignSelect";
import { VehicleReferencePhotoEditor } from "@/components/shared/VehicleReferencePhotoEditor";
import { vehiclePhotosFromRecord } from "@/components/shared/VehicleReferencePhotos";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import { SeatCategorySelect } from "@/components/shared/SeatCategorySelect";
import type { VehicleModel } from "@/features/master-data/api";
import { roleSlugForVehicleAssignment } from "@/lib/staff-ecosystem/roles";
import { CustomerProfileBackLink } from "@/components/layout/CustomerBookingDataContext";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import { categorySlugToVehicleType } from "@/lib/vehicleMaster";

function parseCoordinateInput(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  // 1. Google Maps link: ...@25.298541,82.991245... or ?q=25.298541,82.991245
  const linkMatch = trimmed.match(/[@?&](?:q=|ll=|location=)?(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (linkMatch) {
    const lat = parseFloat(linkMatch[1]!);
    const lng = parseFloat(linkMatch[2]!);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  // 2. Direct coordinate string: "25.298541, 82.991245" or "25.298541 82.991245"
  const directMatch = trimmed.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]!);
    const lng = parseFloat(directMatch[2]!);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export default function AssetDetail() {
  const [, params] = useRoute("/admin/assets/:id");
  const id = parseInt(params?.id ?? "", 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [transferCustomer, setTransferCustomer] = useState<CustomerSearchValue | null>(null);
  const [transferFrom, setTransferFrom] = useState("");
  const [newLocationId, setNewLocationId] = useState("");
  const [locationFrom, setLocationFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);

  // Address & GPS Coordinates state
  const [addressEdit, setAddressEdit] = useState("");
  const [latEdit, setLatEdit] = useState("");
  const [lngEdit, setLngEdit] = useState("");
  const [coordPaste, setCoordPaste] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);

  const [vehicleEdit, setVehicleEdit] = useState({
    registrationNumber: "",
    seatCategoryId: null as number | null,
    year: "",
    color: "",
    label: "",
    notes: "",
  });
  const [solarEdit, setSolarEdit] = useState({
    siteName: "",
    panelCount: "",
    panelCapacityKw: "",
    label: "",
    notes: "",
  });

  const { data: asset, isLoading, refetch } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => getAsset(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const vehicle = asset?.vehicle as Record<string, unknown> | undefined | null;
  const solar = asset?.solarSite as Record<string, unknown> | undefined | null;

  useEffect(() => {
    if (!asset) return;
    if (asset.assetType === "vehicle" && asset.vehicle) {
      const v = asset.vehicle;
      setVehicleEdit({
        registrationNumber: String(v.registrationNumber ?? ""),
        seatCategoryId: v.seatCategoryId != null ? Number(v.seatCategoryId) : null,
        year: v.year != null ? String(v.year) : "",
        color: String(v.color ?? ""),
        label: asset.label ?? "",
        notes: asset.notes ?? "",
      });

      // Populate initial service address and coordinates
      const activeLocLink = (asset.locationLinks as Array<Record<string, unknown>> | undefined)?.find(l => !l.effectiveUntil)
        ?? (asset.locationLinks as Array<Record<string, unknown>> | undefined)?.[0];

      const initialAddr = (v.serviceAddress ? String(v.serviceAddress) : "") || (activeLocLink?.locationAddress ? String(activeLocLink.locationAddress) : "");
      const initialLat = (v.serviceLat != null ? String(v.serviceLat) : "") || (activeLocLink?.latitude != null ? String(activeLocLink.latitude) : "");
      const initialLng = (v.serviceLng != null ? String(v.serviceLng) : "") || (activeLocLink?.longitude != null ? String(activeLocLink.longitude) : "");

      setAddressEdit(initialAddr);
      setLatEdit(initialLat);
      setLngEdit(initialLng);

      const modelId = v.vehicleModelId != null ? Number(v.vehicleModelId) : null;
      if (modelId) {
        setSelectedModel({
          id: modelId,
          brandId: 0,
          name: String(v.model ?? ""),
          slug: "",
          brandName: String(v.make ?? ""),
          categoryName: "",
          categorySlug: String(v.vehicleType ?? "sedan"),
          seatName: "",
          seatCount: 0,
          vehicleCategoryId: 0,
          seatCategoryId: v.seatCategoryId != null ? Number(v.seatCategoryId) : 0,
        });
      } else {
        setSelectedModel(null);
      }
    }
    if (asset.assetType === "solar_site" && asset.solarSite) {
      const s = asset.solarSite;
      setSolarEdit({
        siteName: String(s.siteName ?? ""),
        panelCount: s.panelCount != null ? String(s.panelCount) : "",
        panelCapacityKw: s.panelCapacityKw != null ? String(s.panelCapacityKw) : "",
        label: asset.label ?? "",
        notes: asset.notes ?? "",
      });

      if (s.address) setAddressEdit(String(s.address));
      if (s.serviceLat != null) setLatEdit(String(s.serviceLat));
      if (s.serviceLng != null) setLngEdit(String(s.serviceLng));
    }
  }, [asset?.id, asset?.updatedAt]);

  const activeCustomerId = asset?.customerLinks?.find(l => !l.effectiveUntil)?.customerId
    ?? asset?.customerLinks?.[0]?.customerId;

  const { data: locationsData } = useQuery({
    queryKey: ["service-locations", "asset-detail", activeCustomerId],
    queryFn: () => listServiceLocations({ customerId: activeCustomerId!, limit: 50 }),
    enabled: Boolean(activeCustomerId),
  });

  const handleStaffAssign = async (staffId: string) => {
    if (!asset?.vehicleId) return;
    try {
      await updateAsset(id, {
        assignedStaffId: staffId === "none" ? null : parseInt(staffId, 10),
      });
      await refetch();
      toast({ title: "Staff assignment updated" });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  };

  const handleTransferCustomer = async () => {
    if (!transferCustomer?.id) {
      toast({ title: "Select new customer", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await transferAssetCustomer(id, {
        customerId: transferCustomer.id,
        effectiveFrom: transferFrom || undefined,
      });
      toast({ title: "Ownership transferred — history preserved" });
      setTransferCustomer(null);
      setTransferFrom("");
      await refetch();
      qc.invalidateQueries({ queryKey: ["assets"] });
    } catch (err) {
      toast({ title: "Transfer failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleTransferLocation = async () => {
    if (!newLocationId || !activeCustomerId) {
      toast({ title: "Select service location", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await transferAssetLocation(id, {
        customerId: activeCustomerId,
        serviceLocationId: parseInt(newLocationId, 10),
        effectiveFrom: locationFrom || undefined,
      });
      toast({ title: "Location placement updated" });
      setNewLocationId("");
      setLocationFrom("");
      await refetch();
    } catch (err) {
      toast({ title: "Transfer failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLocation = async () => {
    setSavingLocation(true);
    try {
      const latNum = latEdit.trim() ? parseFloat(latEdit.trim()) : null;
      const lngNum = lngEdit.trim() ? parseFloat(lngEdit.trim()) : null;

      if (latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)) {
        toast({ title: "Invalid Latitude", description: "Latitude must be between -90 and 90", variant: "destructive" });
        setSavingLocation(false);
        return;
      }
      if (lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180)) {
        toast({ title: "Invalid Longitude", description: "Longitude must be between -180 and 180", variant: "destructive" });
        setSavingLocation(false);
        return;
      }

      await updateAsset(id, {
        serviceAddress: addressEdit.trim() || null,
        serviceLat: latNum,
        serviceLng: lngNum,
        address: addressEdit.trim() || undefined,
      });

      toast({
        title: "Location & GPS coordinates saved",
        description: "Directions and Google Maps link updated for Staff app Daily Clean.",
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["assets"] });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Failed to save location",
        variant: "destructive",
      });
    } finally {
      setSavingLocation(false);
    }
  };

  const handlePasteCoord = (value: string) => {
    setCoordPaste(value);
    const parsed = parseCoordinateInput(value);
    if (parsed) {
      setLatEdit(parsed.lat.toFixed(6));
      setLngEdit(parsed.lng.toFixed(6));
      toast({ title: "Coordinates detected!", description: `Lat: ${parsed.lat.toFixed(6)}, Lng: ${parsed.lng.toFixed(6)}` });
    }
  };

  const handleDetectCurrentGps = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", description: "Browser does not support GPS", variant: "destructive" });
      return;
    }
    setGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatEdit(pos.coords.latitude.toFixed(6));
        setLngEdit(pos.coords.longitude.toFixed(6));
        setGettingGps(false);
        toast({
          title: "GPS Location detected",
          description: `Lat: ${pos.coords.latitude.toFixed(6)}, Lng: ${pos.coords.longitude.toFixed(6)}`,
        });
      },
      err => {
        setGettingGps(false);
        toast({ title: "GPS detection failed", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSaveDetails = async () => {
    setBusy(true);
    try {
      if (asset?.assetType === "vehicle") {
        if (!selectedModel || vehicleEdit.seatCategoryId == null || !vehicleEdit.registrationNumber.trim()) {
          toast({ title: "Model, seater, and registration are required", variant: "destructive" });
          setBusy(false);
          return;
        }
        await updateAsset(id, {
          label: vehicleEdit.label.trim() || undefined,
          notes: vehicleEdit.notes || null,
          vehicleModelId: selectedModel.id,
          seatCategoryId: vehicleEdit.seatCategoryId,
          make: selectedModel.brandName,
          model: selectedModel.name,
          vehicleType: categorySlugToVehicleType(selectedModel.categorySlug),
          registrationNumber: vehicleEdit.registrationNumber.trim(),
          year: vehicleEdit.year ? parseInt(vehicleEdit.year, 10) : null,
          color: vehicleEdit.color || null,
        });
      } else {
        const panels = parseInt(solarEdit.panelCount, 10);
        if (!Number.isFinite(panels) || panels < 1) {
          toast({ title: "Panel count is required", variant: "destructive" });
          setBusy(false);
          return;
        }
        await updateAsset(id, {
          label: solarEdit.label.trim() || undefined,
          notes: solarEdit.notes || null,
          siteName: solarEdit.siteName.trim() || undefined,
          panelCount: panels,
          panelCapacityKw: solarEdit.panelCapacityKw.trim() || undefined,
        });
      }
      toast({ title: "Details updated" });
      await refetch();
      qc.invalidateQueries({ queryKey: ["assets"] });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(id) || id <= 0) return null;

  const currentLat = vehicle?.serviceLat != null ? Number(vehicle.serviceLat) : (latEdit ? parseFloat(latEdit) : null);
  const currentLng = vehicle?.serviceLng != null ? Number(vehicle.serviceLng) : (lngEdit ? parseFloat(lngEdit) : null);
  const hasValidGps = currentLat !== null && currentLng !== null && !isNaN(currentLat) && !isNaN(currentLng) && currentLat !== 0 && currentLng !== 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        {activeCustomerId ? (
          <CustomerProfileBackLink customerId={activeCustomerId} />
        ) : (
          <Link href="/admin/assets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Back to Assets
          </Link>
        )}

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : asset ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                {asset.assetType === "vehicle" ? <Car size={28} className="text-primary" /> : <Sun size={28} className="text-primary" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold font-mono tracking-tight">{asset.assetIdentifier}</h1>
                <p className="text-sm text-muted-foreground capitalize">
                  {ASSET_TYPE_LABELS[asset.assetType]} · {asset.status}
                </p>
                {vehicle && (
                  <p className="text-sm mt-1">{String(vehicle.make)} {String(vehicle.model)} · {String(vehicle.vehicleType)}</p>
                )}
                {solar && (
                  <p className="text-sm mt-1">{String(solar.siteName)} · {String(solar.panelCount)} panels</p>
                )}
              </div>
            </div>

            {/* Edit details Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Pencil size={16} className="text-primary" /> Edit details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {asset.assetType === "vehicle" ? (
                  <>
                    <VehicleModelSelect
                      value={selectedModel}
                      onChange={m => setSelectedModel(m)}
                      required
                    />
                    <SeatCategorySelect
                      value={vehicleEdit.seatCategoryId}
                      onChange={id => setVehicleEdit(f => ({ ...f, seatCategoryId: id }))}
                      required
                    />
                    <div>
                      <Label>Registration number *</Label>
                      <Input
                        className="mt-1 font-mono uppercase"
                        value={vehicleEdit.registrationNumber}
                        onChange={e => setVehicleEdit(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Year</Label>
                        <Input
                          className="mt-1"
                          value={vehicleEdit.year}
                          onChange={e => setVehicleEdit(f => ({ ...f, year: e.target.value }))}
                          placeholder="e.g. 2022"
                        />
                      </div>
                      <div>
                        <Label>Color</Label>
                        <Input
                          className="mt-1"
                          value={vehicleEdit.color}
                          onChange={e => setVehicleEdit(f => ({ ...f, color: e.target.value }))}
                          placeholder="e.g. White"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Display label</Label>
                      <Input
                        className="mt-1"
                        value={vehicleEdit.label}
                        onChange={e => setVehicleEdit(f => ({ ...f, label: e.target.value }))}
                        placeholder="Optional nickname"
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        className="mt-1"
                        value={vehicleEdit.notes}
                        onChange={e => setVehicleEdit(f => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Site name</Label>
                      <Input
                        className="mt-1"
                        value={solarEdit.siteName}
                        onChange={e => setSolarEdit(f => ({ ...f, siteName: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Panel count *</Label>
                        <Input
                          type="number"
                          min={1}
                          className="mt-1"
                          value={solarEdit.panelCount}
                          onChange={e => setSolarEdit(f => ({ ...f, panelCount: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Capacity (kW)</Label>
                        <Input
                          className="mt-1"
                          value={solarEdit.panelCapacityKw}
                          onChange={e => setSolarEdit(f => ({ ...f, panelCapacityKw: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Display label</Label>
                      <Input
                        className="mt-1"
                        value={solarEdit.label}
                        onChange={e => setSolarEdit(f => ({ ...f, label: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        className="mt-1"
                        value={solarEdit.notes}
                        onChange={e => setSolarEdit(f => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                <Button onClick={() => void handleSaveDetails()} disabled={busy} data-testid="btn-admin-save-asset">
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              </CardContent>
            </Card>

            {/* PARKING / SERVICE LOCATION & GPS COORDINATES (NEW DIRECT CONTROLS) */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Navigation size={17} className="text-primary" />
                    Parking Location & GPS Coordinates
                  </CardTitle>
                  {hasValidGps ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs gap-1">
                      <CheckCircle2 size={13} /> GPS Linked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-xs gap-1">
                      <AlertTriangle size={13} /> Coordinates Missing
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Daily Clean staff uses these coordinates for turn-by-turn Google Maps navigation. If coordinates are missing, the staff app displays &quot;Location nahi mili&quot;.
                </p>

                {/* Service Address */}
                <div>
                  <Label htmlFor="asset-service-address">Service / Parking Address</Label>
                  <Input
                    id="asset-service-address"
                    className="mt-1"
                    placeholder="e.g. B 75 Gurudham Colony, Durgakund, Varanasi"
                    value={addressEdit}
                    onChange={e => setAddressEdit(e.target.value)}
                  />
                </div>

                {/* Quick Paste Box */}
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-1.5">
                  <Label htmlFor="paste-coord-box" className="text-xs font-semibold text-foreground">
                    Quick Paste: Google Maps Link or Coordinates
                  </Label>
                  <Input
                    id="paste-coord-box"
                    placeholder="Paste link (https://maps.google.com/...) or e.g. 25.281234, 82.986321"
                    value={coordPaste}
                    onChange={e => handlePasteCoord(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Tip: Open Google Maps, tap car location, copy link or coordinates, and paste here. Lat/Lng will auto-fill.
                  </p>
                </div>

                {/* Latitude & Longitude Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="asset-lat">Latitude</Label>
                    <Input
                      id="asset-lat"
                      placeholder="e.g. 25.298541"
                      className="mt-1 font-mono text-sm"
                      value={latEdit}
                      onChange={e => setLatEdit(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="asset-lng">Longitude</Label>
                    <Input
                      id="asset-lng"
                      placeholder="e.g. 82.991245"
                      className="mt-1 font-mono text-sm"
                      value={lngEdit}
                      onChange={e => setLngEdit(e.target.value)}
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={handleSaveLocation}
                    disabled={savingLocation}
                    className="h-9 px-4 font-semibold text-xs"
                    data-testid="btn-save-location-coords"
                  >
                    {savingLocation ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Navigation size={14} className="mr-1.5" />}
                    Save Location & Coordinates
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5"
                    disabled={gettingGps}
                    onClick={handleDetectCurrentGps}
                  >
                    {gettingGps ? <Loader2 size={13} className="animate-spin" /> : <Compass size={13} />}
                    Detect My GPS
                  </Button>

                  {hasValidGps && (
                    <a
                      href={`https://www.google.com/maps?q=${currentLat},${currentLng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline h-9 px-3 rounded-md border border-primary/20 bg-primary/5"
                    >
                      <ExternalLink size={13} />
                      Preview on Google Maps
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {asset.assetType === "vehicle" && asset.vehicleId && vehicle && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Staff assignment</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <StaffAssignSelect
                    roleSlug={roleSlugForVehicleAssignment()}
                    allowUnassigned
                    value={vehicle.assignedStaffId ? String(vehicle.assignedStaffId) : "none"}
                    onValueChange={handleStaffAssign}
                  />
                  <VehicleReferencePhotoEditor
                    vehicleId={asset.vehicleId}
                    initialPhotos={vehiclePhotosFromRecord(vehicle)}
                    compact
                    onUpdated={() => refetch()}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><MapPin size={16} className="text-primary" /> Service address history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(asset.locationLinks ?? []).map(link => (
                  <div key={link.id} className="text-sm border border-border rounded-lg px-3 py-2">
                    <p className="font-medium">{link.locationLabel}</p>
                    <p className="text-xs text-muted-foreground">{link.locationAddress}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{link.effectiveFrom ?? "—"} → {link.effectiveUntil ?? "current"}</p>
                  </div>
                ))}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium">Move to location</p>
                  <select
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={newLocationId}
                    onChange={e => setNewLocationId(e.target.value)}
                  >
                    <option value="">Select service location</option>
                    {(locationsData?.data ?? []).map((l: { id: number; label: string }) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                  <div>
                    <Label>Effective from</Label>
                    <Input type="date" className="mt-1" value={locationFrom} onChange={e => setLocationFrom(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={handleTransferLocation} disabled={busy}>Update placement</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><History size={16} className="text-primary" /> Customer ownership history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(asset.customerLinks ?? []).map(link => (
                  <div key={link.id} className="text-sm border border-border rounded-lg px-3 py-2 flex justify-between gap-2">
                    <div>
                      <Link href={`/admin/customers/${link.customerId}`} className="font-medium text-primary hover:underline">
                        {link.customerName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{link.customerPhone}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{link.effectiveFrom ?? "—"} → {link.effectiveUntil ?? "current"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs h-6 capitalize">{link.linkType}</Badge>
                  </div>
                ))}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium">Transfer ownership</p>
                  <CustomerSearchSelect value={transferCustomer} onChange={setTransferCustomer} />
                  <div>
                    <Label>Effective from</Label>
                    <Input type="date" className="mt-1" value={transferFrom} onChange={e => setTransferFrom(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={handleTransferCustomer} disabled={busy}>Transfer (closes prior link)</Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-muted-foreground">Vehicle or solar site not found.</p>
        )}
      </div>
    </AdminLayout>
  );
}
