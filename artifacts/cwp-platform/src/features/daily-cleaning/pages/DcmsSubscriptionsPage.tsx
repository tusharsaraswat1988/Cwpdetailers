import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { DcmsEntitySearch, type SearchOption } from "../components/DcmsEntitySearch";
import { useDcmsSubscriptions, useDcmsPlans, useDcmsSubscriptionMutations, usePauseMutations } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Pause, Play, UserPlus } from "lucide-react";
import { QuickCreateCustomerForm } from "@/features/customers/components/QuickCreateCustomerForm";

export default function DcmsSubscriptionsPage() {
  const { data: subs, isLoading } = useDcmsSubscriptions();
  const [customer, setCustomer] = useState<SearchOption | null>(null);
  const [vehicle, setVehicle] = useState<SearchOption | null>(null);
  const { data: plans } = useDcmsPlans(vehicle?.id);
  const { create, renew } = useDcmsSubscriptionMutations();
  const { pause, resume } = usePauseMutations();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState<number | null>(null);
  const [pauseForm, setPauseForm] = useState({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
  const [form, setForm] = useState({
    planId: "", startDate: new Date().toISOString().slice(0, 10),
    latitude: "", longitude: "",
  });

  const handleCreate = async () => {
    if (!customer || !vehicle || !form.planId) {
      toast({ title: "Select customer, vehicle, and plan", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        customerId: customer.id,
        vehicleId: vehicle.id,
        planId: Number(form.planId),
        startDate: form.startDate,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      setOpen(false);
      setCustomer(null);
      setVehicle(null);
      toast({ title: "Subscription created" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleRenew = async (id: number) => {
    try {
      await renew.mutateAsync(id);
      toast({ title: "Subscription renewed" });
    } catch (e) {
      toast({ title: "Renewal blocked", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handlePause = async (id: number) => {
    try {
      await pause.mutateAsync({ id, ...pauseForm });
      setPauseOpen(null);
      setPauseForm({ pauseStartDate: "", pauseEndDate: "", pauseReason: "" });
      toast({ title: "Subscription paused" });
    } catch (e) {
      toast({ title: "Pause failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleResume = async (id: number) => {
    try {
      await resume.mutateAsync(id);
      toast({ title: "Subscription resumed" });
    } catch (e) {
      toast({ title: "Resume failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <div className="flex justify-between items-center">
          <h2 className="font-display font-bold text-xl">Subscriptions</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Subscription</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Subscription</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Label>Customer</Label>
                    <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs">
                          <UserPlus size={12} className="mr-1" /> New customer
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Quick create customer</DialogTitle></DialogHeader>
                        <QuickCreateCustomerForm
                          idPrefix="dcms-quick-customer"
                          customerBasePath="/admin/customers"
                          onCreated={c => {
                            setCustomer({ id: c.id, label: `${c.name} · ${c.phone}`, meta: c.phone });
                            setVehicle(null);
                            setQuickCustomerOpen(false);
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  <DcmsEntitySearch type="customers" value={customer} onChange={v => { setCustomer(v); setVehicle(null); setForm(f => ({ ...f, planId: "" })); }} placeholder="Search name or mobile…" />
                </div>
                <div>
                  <Label>Vehicle</Label>
                  <DcmsEntitySearch
                    type="vehicles"
                    value={vehicle}
                    onChange={v => { setVehicle(v); setForm(f => ({ ...f, planId: "" })); }}
                    disabled={!customer}
                    vehicleFilters={{ customerId: customer?.id }}
                    placeholder={customer ? "Registration, brand, or model…" : "Select customer first"}
                  />
                  {vehicle && !vehicle.vehicleModelId && (
                    <p className="text-xs text-amber-600 mt-1">
                      Vehicle is not linked to a car model. Update the vehicle with type + seater before subscribing.
                    </p>
                  )}
                  {vehicle?.vehicleCategoryName && vehicle.seatCategoryName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {vehicle.vehicleCategoryName} · {vehicle.seatCategoryName}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Plan</Label>
                  <Select
                    value={form.planId}
                    onValueChange={v => setForm(f => ({ ...f, planId: v }))}
                    disabled={!vehicle?.vehicleModelId}
                  >
                    <SelectTrigger><SelectValue placeholder={vehicle ? "Select matching plan" : "Select vehicle first"} /></SelectTrigger>
                    <SelectContent>
                      {plans?.filter(p => p.isActive).map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} — ₹{Number(p.price).toLocaleString("en-IN")}
                          {p.seatPricingTierLabel ? ` (${p.seatPricingTierLabel})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {vehicle?.vehicleModelId && plans?.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      No plans for this car type and seater count. Create a matching plan first.
                    </p>
                  )}
                </div>
                <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Latitude</Label><Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
                  <div><Label>Longitude</Label><Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
                </div>
                <Button onClick={handleCreate} disabled={create.isPending} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <p>Loading...</p> : (
          <div className="space-y-3">
            {subs?.map(row => {
              const s = row.subscription;
              const stats = (row as { visitStats?: { pendingCleanings: number; missedCleanings: number; completedCleanings: number; allocatedCleanings: number } }).visitStats;
              const renewalEligible = (row as { renewalEligible?: boolean }).renewalEligible;
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.customerName} · {row.vehicleNumber}</p>
                      <p className="text-sm text-muted-foreground">{row.planName} · {row.vehicleMake} {row.vehicleModel}</p>
                      {stats && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                          <span>Allocated: {stats.allocatedCleanings}</span>
                          <span>Completed: {stats.completedCleanings}</span>
                          <span className="text-amber-600">Pending: {stats.pendingCleanings}</span>
                          <span className="text-red-600">Missed: {stats.missedCleanings}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                      {s.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => setPauseOpen(s.id)}>
                          <Pause className="h-3 w-3 mr-1" /> Pause
                        </Button>
                      )}
                      {s.status === "paused" && (
                        <Button size="sm" variant="outline" onClick={() => handleResume(s.id)}>
                          <Play className="h-3 w-3 mr-1" /> Resume
                        </Button>
                      )}
                      {renewalEligible ? (
                        <Button size="sm" variant="outline" onClick={() => handleRenew(s.id)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Renew
                        </Button>
                      ) : s.status === "active" && stats && stats.pendingCleanings > 0 && (
                        <span className="text-xs text-muted-foreground">Renewal blocked — pending visits remain</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={pauseOpen != null} onOpenChange={v => !v && setPauseOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pause Subscription</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Start Date</Label><Input type="date" value={pauseForm.pauseStartDate} onChange={e => setPauseForm(f => ({ ...f, pauseStartDate: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={pauseForm.pauseEndDate} onChange={e => setPauseForm(f => ({ ...f, pauseEndDate: e.target.value }))} /></div>
              <div><Label>Reason</Label><Input value={pauseForm.pauseReason} onChange={e => setPauseForm(f => ({ ...f, pauseReason: e.target.value }))} /></div>
              <Button onClick={() => pauseOpen && handlePause(pauseOpen)} disabled={pause.isPending} className="w-full">Confirm Pause</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
