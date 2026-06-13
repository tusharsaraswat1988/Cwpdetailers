import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListServices, getListServicesQueryKey,
  useCreateBooking, getListBookingsQueryKey,
  useListVehicles, getListVehiclesQueryKey,
  useListSolarSites, getListSolarSitesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import { computeSolarCleaningPrice } from "@/lib/solar-pricing";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFormDraft } from "@/hooks/useFormDraft";
import { moduleError } from "@/lib/moduleErrors";
import { Loader2, CheckCircle, Car, Sun, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const SERVICE_TYPE_CATEGORIES: Record<string, string> = {
  car_wash: "car_wash",
  detailing: "detailing",
  solar_cleaning: "solar_cleaning",
  pickup_drop: "car_wash",
};

const defaultBookingForm = {
  serviceId: "",
  serviceType: "car_wash",
  scheduledDate: "",
  scheduledTime: "09:00",
  notes: "",
  vehicleId: "",
  solarSiteId: "",
};

export default function BookService() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [success, setSuccess] = useState(false);
  const { value: form, setValue: setForm, clearDraft, restoredFromDraft } = useFormDraft(
    "customer-booking-form",
    defaultBookingForm,
  );

  const { data: services } = useListServices({ isActive: true }, { query: { queryKey: getListServicesQueryKey({ isActive: true }) } });
  const { data: vehicles } = useListVehicles({ customerId: customerId ?? 0 }, {
    query: { queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null },
  });
  const { data: solarSites } = useListSolarSites({ customerId: customerId ?? 0 }, {
    query: { queryKey: getListSolarSitesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null },
  });

  const filteredServices = useMemo(() => {
    const cat = SERVICE_TYPE_CATEGORIES[form.serviceType] ?? form.serviceType;
    return (services ?? []).filter(s => s.category === cat);
  }, [services, form.serviceType]);

  const selectedService = filteredServices.find(s => String(s.id) === form.serviceId);
  const selectedSolar = (solarSites ?? []).find(s => String(s.id) === form.solarSiteId);

  const estimatedPrice = useMemo(() => {
    if (form.serviceType === "solar_cleaning" && selectedSolar) {
      return computeSolarCleaningPrice(selectedSolar.panelCount);
    }
    if (selectedService) return Number(selectedService.basePrice);
    return null;
  }, [form.serviceType, selectedService, selectedSolar]);

  const needsVehicle = ["car_wash", "detailing", "pickup_drop"].includes(form.serviceType);
  const needsSolar = form.serviceType === "solar_cleaning";
  const hasVehicle = (vehicles ?? []).length > 0;
  const hasSolar = (solarSites ?? []).length > 0;

  const createMutation = useCreateBooking({
    mutation: {
      onSuccess: async () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        await clearDraft();
        setSuccess(true);
        toast({ title: "Booking confirmed!" });
      },
      onError: () => toast({ title: moduleError("bookings", "save"), variant: "destructive" }),
    },
  });

  const today = new Date().toISOString().split("T")[0];

  const canSubmit =
    form.scheduledDate &&
    (!needsVehicle || form.vehicleId) &&
    (!needsSolar || form.solarSiteId) &&
    (form.serviceType === "solar_cleaning" || form.serviceId);

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <div className="p-6"><Loader2 className="animate-spin" /></div>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="p-6 max-w-md mx-auto text-center space-y-2">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a customer profile. Contact CWP support.</p>
        </div>
      </CustomerLayout>
    );
  }

  if (success) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-full max-w-sm text-center"
          >
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 mx-auto">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h2 className="font-display font-bold text-2xl mb-2">Booking Confirmed!</h2>
            <p className="text-muted-foreground mb-8">Our technician will reach you at the scheduled time.</p>
            {/* QW-06: View History link */}
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  setSuccess(false);
                  setForm(defaultBookingForm);
                }}
                className="w-full h-11 bg-primary text-secondary hover:bg-primary/90"
              >
                Book Another Service
              </Button>
              <Link href="/customer/history">
                <Button variant="outline" className="w-full h-11">View My Bookings</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Book a Service</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Schedule your next car wash, detailing, or solar cleaning.</p>
          {restoredFromDraft && (
            <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded-md px-3 py-2 inline-block">
              Restored your previous booking draft.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {["car_wash", "detailing", "solar_cleaning", "pickup_drop"].map(type => (
            <button key={type}
              onClick={() => setForm(f => ({ ...f, serviceType: type, serviceId: "", vehicleId: "", solarSiteId: "" }))}
              data-testid={`type-${type}`}
              className={`p-4 rounded-xl border text-left transition-all ${form.serviceType === type ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                {type === "solar_cleaning" ? <Sun size={14} className="text-primary" /> : <Car size={14} className="text-primary" />}
                <span className="font-medium text-sm capitalize">{type.replace(/_/g, " ")}</span>
              </div>
            </button>
          ))}
        </div>

        {needsVehicle && !hasVehicle && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-800">Add a vehicle first</p>
            <p className="text-amber-700 text-xs mt-1 mb-3">Register your car before booking a wash or detailing service.</p>
            <Link href="/customer/assets">
              <Button size="sm" variant="outline" className="gap-1" data-testid="link-add-vehicle">
                Go to My Assets <ArrowRight size={12} />
              </Button>
            </Link>
          </div>
        )}

        {needsSolar && !hasSolar && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-800">Add a solar site first</p>
            <p className="text-amber-700 text-xs mt-1 mb-3">Register your solar installation with panel count for pricing.</p>
            <Link href="/customer/assets">
              <Button size="sm" variant="outline" className="gap-1" data-testid="link-add-solar">
                Go to My Assets <ArrowRight size={12} />
              </Button>
            </Link>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {form.serviceType !== "solar_cleaning" && (
            <div>
              <Label>Select Service</Label>
              <Select value={form.serviceId} onValueChange={v => setForm(f => ({ ...f, serviceId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-service">
                  <SelectValue placeholder="Choose a service..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredServices.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — ₹{Number(s.basePrice).toLocaleString("en-IN")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredServices.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No services available for this type.</p>
              )}
            </div>
          )}

          {needsVehicle && hasVehicle && (
            <div>
              <Label>Vehicle</Label>
              <Select value={form.vehicleId} onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-vehicle">
                  <SelectValue placeholder="Select vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  {(vehicles ?? []).map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.make} {v.model} ({v.registrationNumber})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsSolar && hasSolar && (
            <div>
              <Label>Solar site</Label>
              <Select value={form.solarSiteId} onValueChange={v => setForm(f => ({ ...f, solarSiteId: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-solar">
                  <SelectValue placeholder="Select solar site..." />
                </SelectTrigger>
                <SelectContent>
                  {(solarSites ?? []).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.address} ({s.panelCount} panels)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {estimatedPrice != null && (
            <div className="bg-muted/50 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estimated price</span>
              <span className="font-semibold text-primary" data-testid="estimated-price">
                ₹{estimatedPrice.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" min={today} value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="mt-1" data-testid="input-date" />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))} className="mt-1" data-testid="input-time" />
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." className="mt-1" data-testid="input-notes" />
          </div>

          <Button
            data-testid="btn-confirm-booking"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate({
              data: {
                customerId,
                serviceId: form.serviceId ? parseInt(form.serviceId) : undefined,
                vehicleId: form.vehicleId ? parseInt(form.vehicleId) : undefined,
                solarSiteId: form.solarSiteId ? parseInt(form.solarSiteId) : undefined,
                serviceType: form.serviceType as "car_wash" | "detailing" | "solar_cleaning" | "pickup_drop" | "emergency",
                scheduledDate: form.scheduledDate,
                scheduledTime: form.scheduledTime,
                notes: form.notes || undefined,
              },
            })}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold"
          >
            {createMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Booking...</> : "Confirm Booking"}
          </Button>
        </div>
      </div>
    </CustomerLayout>
  );
}
