import { useState } from "react";
import { useListServices, getListServicesQueryKey, useCreateBooking, getListBookingsQueryKey, useListVehicles, getListVehiclesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Car, Sun } from "lucide-react";
import { motion } from "framer-motion";

export default function BookService() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<{ serviceId: string; serviceType: string; scheduledDate: string; scheduledTime: string; notes: string; vehicleId?: string }>({
    serviceId: "", serviceType: "car_wash", scheduledDate: "", scheduledTime: "09:00", notes: ""
  });

  const { data: services } = useListServices({ isActive: true }, { query: { queryKey: getListServicesQueryKey({ isActive: true }) } });
  const { data: vehicles } = useListVehicles({ customerId: 1 }, { query: { queryKey: getListVehiclesQueryKey({ customerId: 1 }) } });

  const createMutation = useCreateBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
        setSuccess(true);
        toast({ title: "Booking confirmed!" });
      },
      onError: () => toast({ title: "Booking failed", variant: "destructive" }),
    },
  });

  const today = new Date().toISOString().split("T")[0];

  if (success) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h2 className="font-display font-bold text-2xl text-center mb-2">Booking Confirmed!</h2>
            <p className="text-muted-foreground text-center mb-8">Our technician will reach you at the scheduled time.</p>
            <Button onClick={() => setSuccess(false)} className="bg-primary text-secondary hover:bg-primary/90">Book Another Service</Button>
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          {["car_wash", "detailing", "solar_cleaning", "pickup_drop"].map(type => (
            <button key={type}
              onClick={() => setForm(f => ({ ...f, serviceType: type }))}
              data-testid={`type-${type}`}
              className={`p-4 rounded-xl border text-left transition-all ${form.serviceType === type ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                {type === "solar_cleaning" ? <Sun size={14} className="text-primary" /> : <Car size={14} className="text-primary" />}
                <span className="font-medium text-sm capitalize">{type.replace(/_/g, " ")}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <Label>Select Service</Label>
            <Select value={form.serviceId} onValueChange={v => setForm(f => ({ ...f, serviceId: v }))}>
              <SelectTrigger className="mt-1" data-testid="select-service">
                <SelectValue placeholder="Choose a service..." />
              </SelectTrigger>
              <SelectContent>
                {(services ?? []).filter(s => s.category.includes(form.serviceType.split("_")[0])).map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} — ₹{Number(s.basePrice).toLocaleString("en-IN")}
                  </SelectItem>
                ))}
                {(services ?? []).map(s => (
                  <SelectItem key={`all-${s.id}`} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(vehicles ?? []).length > 0 && (
            <div>
              <Label>Vehicle (optional)</Label>
              <Select onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
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
            disabled={!form.scheduledDate || createMutation.isPending}
            onClick={() => createMutation.mutate({
              data: {
                customerId: 1,
                serviceId: form.serviceId ? parseInt(form.serviceId) : undefined,
                serviceType: form.serviceType as "car_wash" | "detailing" | "solar_cleaning" | "pickup_drop" | "emergency",
                scheduledDate: form.scheduledDate,
                scheduledTime: form.scheduledTime,
                notes: form.notes || undefined,
              }
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
