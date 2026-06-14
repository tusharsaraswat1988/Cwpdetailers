import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVehicles,
  getListVehiclesQueryKey,
  useListSolarSites,
  getListSolarSitesQueryKey,
  getGetCustomerSummaryQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Plus,
} from "lucide-react";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { StaffAssignSelect } from "@/components/shared/StaffAssignSelect";
import type { LocationValue } from "@/features/master-data/api";
import { useCatalogServices } from "@/features/master-data/api";
import {
  grantCustomerPackage,
  createCustomerBooking,
} from "../api";
import { useDcmsPlans, useDcmsSubscriptionMutations, type DcmsPlan } from "@/features/daily-cleaning/api";
import { useCatalogPackages, useCatalogPricingQuote, useCatalogAddons, type CatalogPackage } from "@/features/service-catalog/api";
import { OPERATIONAL_ROLE_SLUGS, roleSlugForBookingService } from "@/lib/staff-ecosystem/roles";
import { BookingAddonsField } from "./BookingAddonsField";
import {
  SERVICE_PRODUCT_LIST,
  type ServiceProductId,
} from "@workspace/customer-model";
import { serviceProductIcon } from "./serviceProductIcons";

export type CustomerServiceProduct = ServiceProductId;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  basePath: string;
  initialProduct?: CustomerServiceProduct;
  onSuccess?: () => void;
};

type WizardStep = "pick" | "configure" | "done";

type VehicleRow = {
  id: number;
  registrationNumber?: string;
  make?: string;
  model?: string;
  vehicleModelId?: number | null;
  serviceAddress?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
  locationComplete?: boolean;
};

type SolarSiteRow = {
  id: number;
  address?: string;
  panelCount?: number;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
  locationComplete?: boolean;
};

const PRODUCTS = SERVICE_PRODUCT_LIST.map(p => ({
  ...p,
  icon: serviceProductIcon(p.icon),
}));

function isSolarAmcPackage(pkg: CatalogPackage) {
  return pkg.slug?.includes("solar-amc") ?? pkg.name.toLowerCase().includes("solar amc");
}

function isWashPackage(pkg: CatalogPackage) {
  return !isSolarAmcPackage(pkg);
}

export function AddCustomerServiceWizard({
  open,
  onOpenChange,
  customerId,
  basePath,
  initialProduct,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("pick");
  const [product, setProduct] = useState<CustomerServiceProduct | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  const [vehicleId, setVehicleId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dcmsStaffId, setDcmsStaffId] = useState("none");

  const [packageId, setPackageId] = useState("");

  const [serviceId, setServiceId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [bookingStaffId, setBookingStaffId] = useState("none");
  const [bookingNotes, setBookingNotes] = useState("");
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);

  const [solarSiteId, setSolarSiteId] = useState("");

  const { data: vehicles } = useListVehicles(
    { customerId: String(customerId) } as any,
    {
      query: {
        queryKey: getListVehiclesQueryKey({ customerId: String(customerId) } as any),
        enabled: customerId > 0 && open,
      },
    },
  );

  const { data: solarSites, refetch: refetchSolarSites } = useListSolarSites(
    { customerId } as any,
    {
      query: {
        queryKey: getListSolarSitesQueryKey({ customerId } as any),
        enabled: customerId > 0 && open,
      },
    },
  );

  const vehicleIdNum = vehicleId ? parseInt(vehicleId, 10) : undefined;
  const { data: dcmsPlans } = useDcmsPlans(vehicleIdNum);
  const { data: packages } = useCatalogPackages();
  const { data: catalogServices } = useCatalogServices();
  const { create: createDcms, assign: assignDcms } = useDcmsSubscriptionMutations();

  const washPackages = useMemo(() => (packages ?? []).filter(isWashPackage), [packages]);
  const solarAmcPackages = useMemo(() => (packages ?? []).filter(isSolarAmcPackage), [packages]);

  const carWashServices = useMemo(() => {
    return (catalogServices ?? []).filter(s => {
      const slug = (s.categorySlug ?? s.category ?? "").toLowerCase();
      return slug.includes("car") || slug.includes("wash") || s.category === "car_wash";
    });
  }, [catalogServices]);

  const solarServices = useMemo(() => {
    return (catalogServices ?? []).filter(s => {
      const slug = (s.categorySlug ?? s.category ?? "").toLowerCase();
      return slug.includes("solar") || s.category === "solar_cleaning";
    });
  }, [catalogServices]);

  const selectedVehicle = (vehicles as VehicleRow[] | undefined)?.find(v => String(v.id) === vehicleId);
  const selectedSolarSite = (solarSites as SolarSiteRow[] | undefined)?.find(s => String(s.id) === solarSiteId);
  const selectedDcmsPlan = (dcmsPlans ?? []).find(p => String(p.id) === planId) as DcmsPlan | undefined;
  const selectedWashService = carWashServices.find(s => String(s.id) === serviceId);

  const serviceIdNum = serviceId ? parseInt(serviceId, 10) : undefined;
  const { data: pricingQuote } = useCatalogPricingQuote({
    serviceId: product === "one_time_wash" ? serviceIdNum : undefined,
    vehicleModelId: selectedVehicle?.vehicleModelId ?? undefined,
    citySlug: "varanasi",
  });
  const { data: catalogAddons } = useCatalogAddons(
    product === "one_time_wash" ? serviceIdNum : undefined,
  );

  const washEstimatedPrice = useMemo(() => {
    if (product !== "one_time_wash" || !selectedWashService) return null;
    const base = pricingQuote?.amount != null
      ? Number(pricingQuote.amount)
      : Number(selectedWashService.basePrice ?? 0);
    const addonTotal = (catalogAddons ?? [])
      .filter(a => selectedAddonIds.includes(a.id))
      .reduce((sum, a) => sum + Number(a.basePrice), 0);
    return base + addonTotal;
  }, [product, selectedWashService, pricingQuote, catalogAddons, selectedAddonIds]);

  useEffect(() => {
    setSelectedAddonIds([]);
  }, [serviceId]);

  const reset = () => {
    setStep("pick");
    setProduct(null);
    setSubmitting(false);
    setDoneMessage("");
    setVehicleId("");
    setPlanId("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setDcmsStaffId("none");
    setPackageId("");
    setServiceId("");
    setScheduledDate("");
    setScheduledTime("09:00");
    setBookingStaffId("none");
    setBookingNotes("");
    setSelectedAddonIds([]);
    setSolarSiteId("");
    setSolarMode("existing");
    setSolarLocation(null);
    setPanelCount("");
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    if (initialProduct) {
      setProduct(initialProduct);
      setStep("configure");
    } else {
      setStep("pick");
      setProduct(null);
    }
  }, [open, initialProduct]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customer", customerId, "services-hub"] });
    qc.invalidateQueries({ queryKey: getGetCustomerSummaryQueryKey(customerId) });
    qc.invalidateQueries({ queryKey: ["customer-360-invoices", customerId] });
    qc.invalidateQueries({ queryKey: getListInvoicesQueryKey({ customerId: String(customerId) } as any) });
    qc.invalidateQueries({ queryKey: getListVehiclesQueryKey({ customerId: String(customerId) } as any) });
    qc.invalidateQueries({ queryKey: getListSolarSitesQueryKey({ customerId } as any) });
    qc.invalidateQueries({ queryKey: ["dcms"] });
    onSuccess?.();
  };

  const pickProduct = (p: CustomerServiceProduct) => {
    setProduct(p);
    setStep("configure");
  };

  const resolveSolarSiteId = async (): Promise<number> => {
    if (!solarSiteId) throw new Error("Select a solar site");
    return parseInt(solarSiteId, 10);
  };

  const getSolarSiteLocation = async (siteId: number) => {
    const sites = (await refetchSolarSites()).data as SolarSiteRow[] | undefined;
    const site = sites?.find(s => s.id === siteId) ?? selectedSolarSite;
    if (!site?.locationComplete || site.serviceLat == null || site.serviceLng == null) {
      throw new Error("Solar site needs a complete service location");
    }
    return {
      address: site.address ?? "",
      locationLat: site.serviceLat,
      locationLng: site.serviceLng,
      placeId: site.placeId ?? undefined,
    };
  };

  const handleSubmit = async () => {
    if (!product) return;
    setSubmitting(true);
    try {
      if (product === "daily_cleaning") {
        if (!vehicleId || !planId) throw new Error("Select vehicle and plan");
        const sub = await createDcms.mutateAsync({
          customerId,
          vehicleId: parseInt(vehicleId, 10),
          planId: parseInt(planId, 10),
          startDate,
        }) as { id: number };
        if (dcmsStaffId !== "none") {
          await assignDcms.mutateAsync({
            subscriptionId: sub.id,
            staffId: parseInt(dcmsStaffId, 10),
          });
        }
        setDoneMessage("Daily cleaning plan created.");
      } else if (product === "wash_package") {
        if (!packageId) throw new Error("Select a package");
        await grantCustomerPackage(customerId, parseInt(packageId, 10));
        setDoneMessage("Wash package granted.");
      } else if (product === "solar_amc") {
        if (!packageId) throw new Error("Select an AMC package");
        const siteId = await resolveSolarSiteId();
        await grantCustomerPackage(customerId, parseInt(packageId, 10), { solarSiteId: siteId });
        setDoneMessage(`Solar AMC granted for site #${siteId}.`);
      } else if (product === "one_time_wash") {
        if (!vehicleId || !serviceId || !scheduledDate) {
          throw new Error("Select vehicle, service, and date");
        }
        if (!selectedVehicle?.locationComplete || selectedVehicle.serviceLat == null || selectedVehicle.serviceLng == null) {
          throw new Error("Vehicle needs a service location — update it under Vehicles tab");
        }
        const svc = carWashServices.find(s => String(s.id) === serviceId);
        await createCustomerBooking({
          customerId,
          vehicleId: parseInt(vehicleId, 10),
          serviceId: parseInt(serviceId, 10),
          staffId: bookingStaffId !== "none" ? parseInt(bookingStaffId, 10) : undefined,
          scheduledDate,
          scheduledTime,
          serviceType: svc?.category ?? "car_wash",
          address: selectedVehicle.serviceAddress ?? "",
          locationLat: selectedVehicle.serviceLat,
          locationLng: selectedVehicle.serviceLng!,
          placeId: selectedVehicle.placeId ?? undefined,
          notes: bookingNotes || undefined,
          citySlug: "varanasi",
          addonIds: selectedAddonIds.length ? selectedAddonIds : undefined,
        });
        setDoneMessage("Car wash booking created.");
      } else if (product === "one_time_solar") {
        if (!serviceId || !scheduledDate) throw new Error("Select service and date");
        const siteId = await resolveSolarSiteId();
        const loc = await getSolarSiteLocation(siteId);
        const svc = solarServices.find(s => String(s.id) === serviceId);
        await createCustomerBooking({
          customerId,
          solarSiteId: siteId,
          serviceId: parseInt(serviceId, 10),
          staffId: bookingStaffId !== "none" ? parseInt(bookingStaffId, 10) : undefined,
          scheduledDate,
          scheduledTime,
          serviceType: "solar_cleaning",
          address: loc.address,
          locationLat: loc.locationLat,
          locationLng: loc.locationLng,
          placeId: loc.placeId,
          notes: bookingNotes || undefined,
          citySlug: "varanasi",
        });
        setDoneMessage("Solar cleaning booking created.");
      }
      invalidate();
      setStep("done");
    } catch (e) {
      toast({
        title: "Could not complete",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitle = step === "pick"
    ? "Add service"
    : step === "configure"
      ? PRODUCTS.find(p => p.id === product)?.label ?? "Configure"
      : "Service added";

  const bookingRole = product === "one_time_solar"
    ? roleSlugForBookingService("solar_cleaning")
    : roleSlugForBookingService("car_wash");

  const solarSitesList = (solarSites as SolarSiteRow[] | undefined) ?? [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="add-customer-service-wizard">
        <DialogHeader>
          <DialogTitle>{stepTitle}</DialogTitle>
        </DialogHeader>

        {step === "pick" && (
          <div className="grid gap-2">
            {PRODUCTS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickProduct(p.id)}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-colors"
                data-testid={`pick-product-${p.id}`}
              >
                <p.icon size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-muted-foreground shrink-0 mt-0.5" />
              </button>
            ))}
          </div>
        )}

        {step === "configure" && product && (
          <div className="space-y-4">
            {!initialProduct && (
              <Button variant="ghost" size="sm" className="px-0 h-auto" onClick={() => setStep("pick")}>
                <ChevronLeft size={14} className="mr-1" /> Change product
              </Button>
            )}

            {product === "daily_cleaning" && (
              <>
                <VehicleSelect
                  vehicles={(vehicles as VehicleRow[] | undefined) ?? []}
                  value={vehicleId}
                  onChange={v => { setVehicleId(v); setPlanId(""); }}
                  basePath={basePath}
                  customerId={customerId}
                />
                <div>
                  <Label>DCMS plan</Label>
                  <Select value={planId || "none"} onValueChange={v => setPlanId(v === "none" ? "" : v)} disabled={!vehicleId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Select plan</SelectItem>
                      {(dcmsPlans ?? []).map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{p.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDcmsPlan && (selectedDcmsPlan.addons ?? []).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Includes: {(selectedDcmsPlan.addons ?? []).map(a => a.addonName).join(", ")}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Start date</Label>
                  <Input type="date" className="mt-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>Assign daily cleaner (optional)</Label>
                  <StaffAssignSelect
                    roleSlug={OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER}
                    allowUnassigned
                    value={dcmsStaffId}
                    onValueChange={setDcmsStaffId}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {product === "wash_package" && (
              <div>
                <Label>Wash package</Label>
                <Select value={packageId || "none"} onValueChange={v => setPackageId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select package" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select package</SelectItem>
                    {washPackages.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{p.price}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {product === "solar_amc" && (
              <>
                <SolarSiteFields
                  sites={solarSitesList}
                  siteId={solarSiteId}
                  onSiteIdChange={setSolarSiteId}
                />
                <div>
                  <Label>AMC package</Label>
                  <Select value={packageId || "none"} onValueChange={v => setPackageId(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select AMC" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Select package</SelectItem>
                      {solarAmcPackages.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{p.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {(product === "one_time_wash" || product === "one_time_solar") && (
              <>
                {product === "one_time_wash" && (
                  <VehicleSelect
                    vehicles={(vehicles as VehicleRow[] | undefined) ?? []}
                    value={vehicleId}
                    onChange={setVehicleId}
                    basePath={basePath}
                    customerId={customerId}
                    showLocationWarning
                    selectedVehicle={selectedVehicle}
                  />
                )}
                {product === "one_time_solar" && (
                  <SolarSiteFields
                    sites={solarSitesList}
                    siteId={solarSiteId}
                    onSiteIdChange={setSolarSiteId}
                  />
                )}
                <div>
                  <Label>Service</Label>
                  <Select value={serviceId || "none"} onValueChange={v => setServiceId(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>Select service</SelectItem>
                      {(product === "one_time_wash" ? carWashServices : solarServices).map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {product === "one_time_wash" && serviceIdNum && (
                  <BookingAddonsField
                    serviceId={serviceIdNum}
                    selectedAddonIds={selectedAddonIds}
                    onChange={setSelectedAddonIds}
                  />
                )}
                {product === "one_time_wash" && washEstimatedPrice != null && (
                  <p className="text-sm text-muted-foreground">
                    Estimated total: <span className="font-semibold text-foreground">₹{washEstimatedPrice.toLocaleString("en-IN")}</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" className="mt-1" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" className="mt-1" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                  </div>
                </div>
                {bookingRole && (
                  <div>
                    <Label>Assign staff (optional)</Label>
                    <StaffAssignSelect
                      roleSlug={bookingRole}
                      allowUnassigned
                      value={bookingStaffId}
                      onValueChange={setBookingStaffId}
                      className="mt-1"
                    />
                  </div>
                )}
                <div>
                  <Label>Notes</Label>
                  <Input className="mt-1" value={bookingNotes} onChange={e => setBookingNotes(e.target.value)} placeholder="Optional" />
                </div>
              </>
            )}

            <Button
              className="w-full bg-primary text-secondary"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              data-testid="btn-wizard-submit"
            >
              {submitting ? "Saving..." : product === "one_time_wash" || product === "one_time_solar" ? "Create booking" : "Confirm"}
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-2">
            <CheckCircle size={40} className="mx-auto text-green-500" />
            <p className="font-medium">{doneMessage}</p>
            <Button className="w-full bg-primary text-secondary" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VehicleSelect({
  vehicles,
  value,
  onChange,
  basePath,
  customerId,
  showLocationWarning,
  selectedVehicle,
}: {
  vehicles: VehicleRow[];
  value: string;
  onChange: (v: string) => void;
  basePath: string;
  customerId: number;
  showLocationWarning?: boolean;
  selectedVehicle?: VehicleRow;
}) {
  return (
    <div>
      <Label>Vehicle</Label>
      <Select value={value || "none"} onValueChange={v => onChange(v === "none" ? "" : v)}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none" disabled>Select vehicle</SelectItem>
          {vehicles.map(v => (
            <SelectItem key={v.id} value={String(v.id)}>
              {v.registrationNumber} · {v.make} {v.model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {vehicles.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          <Link href={`${basePath}/${customerId}?tab=vehicles`} className="text-primary hover:underline">Add a vehicle</Link> first.
        </p>
      )}
      {showLocationWarning && selectedVehicle && !selectedVehicle.locationComplete && (
        <p className="text-xs text-amber-600 mt-1">
          This vehicle has no service location.{" "}
          <Link href={`${basePath}/${customerId}?tab=vehicles`} className="underline">Update vehicle</Link> before booking.
        </p>
      )}
    </div>
  );
}

function SolarSiteFields({
  sites,
  siteId,
  onSiteIdChange,
}: {
  sites: SolarSiteRow[];
  siteId: string;
  onSiteIdChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>Solar site</Label>
      <Select value={siteId || "none"} onValueChange={v => onSiteIdChange(v === "none" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder="Select solar site" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none" disabled>Select site</SelectItem>
          {sites.map(s => (
            <SelectItem key={s.id} value={String(s.id)}>{s.address} ({s.panelCount} panels)</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {sites.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No solar sites linked to this customer. Create one in{" "}
          <Link href="/admin/assets" className="text-primary hover:underline">Assets</Link> first.
        </p>
      )}
    </div>
  );
}
