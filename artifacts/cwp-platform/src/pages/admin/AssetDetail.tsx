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
import { ArrowLeft, Car, Sun, History, MapPin, Pencil } from "lucide-react";
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

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        {activeCustomerId ? (
          <CustomerProfileBackLink customerId={activeCustomerId} label="Back to customer profile" />
        ) : (
          <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft size={14} /> Back to Customer Profile
          </Link>
        )}

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : asset ? (
          <>
            <div className="flex items-start gap-3">
              {asset.assetType === "vehicle" ? <Car size={28} className="text-primary" /> : <Sun size={28} className="text-primary" />}
              <div>
                <h1 className="font-display font-bold text-2xl">{asset.label}</h1>
                <p className="text-sm text-muted-foreground">{ASSET_TYPE_LABELS[asset.assetType]} · {asset.status}</p>
                {vehicle && (
                  <p className="text-sm mt-1">{String(vehicle.make)} {String(vehicle.model)} · {String(vehicle.vehicleType)}</p>
                )}
                {solar && (
                  <p className="text-sm mt-1">{String(solar.panelCapacityKw)} kW · {String(solar.panelCount)} panels</p>
                )}
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pencil size={16} className="text-primary" /> Edit details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {asset.assetType === "vehicle" ? (
                  <>
                    <VehicleModelSelect
                      selected={selectedModel}
                      modelId={selectedModel?.id}
                      onSelect={model => {
                        setSelectedModel(model);
                        if (model?.seatCategoryId != null) {
                          setVehicleEdit(f => ({ ...f, seatCategoryId: model.seatCategoryId }));
                        }
                      }}
                    />
                    <SeatCategorySelect
                      value={vehicleEdit.seatCategoryId}
                      onChange={seatId => setVehicleEdit(f => ({ ...f, seatCategoryId: seatId }))}
                      model={selectedModel}
                    />
                    <div>
                      <Label>Registration number *</Label>
                      <Input
                        className="mt-1"
                        value={vehicleEdit.registrationNumber}
                        onChange={e => setVehicleEdit(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
                        data-testid="input-admin-edit-reg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Year</Label>
                        <Input
                          type="number"
                          className="mt-1"
                          value={vehicleEdit.year}
                          onChange={e => setVehicleEdit(f => ({ ...f, year: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Color</Label>
                        <Input
                          className="mt-1"
                          value={vehicleEdit.color}
                          onChange={e => setVehicleEdit(f => ({ ...f, color: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Display label</Label>
                      <Input
                        className="mt-1"
                        value={vehicleEdit.label}
                        onChange={e => setVehicleEdit(f => ({ ...f, label: e.target.value }))}
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
