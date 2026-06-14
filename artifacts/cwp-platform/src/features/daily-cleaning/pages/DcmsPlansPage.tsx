import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useDcmsPlans, useDcmsPlanMutations } from "../api";
import { useVehicleCategories, useSeatCategories } from "@/features/master-data/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const SEAT_TIER_OPTIONS = [
  { value: "standard", label: "Up to 5 Seater", slug: "5-seater" },
  { value: "large", label: "5+ Seater", slug: "7-seater" },
] as const;

export default function DcmsPlansPage() {
  const { data: plans, isLoading } = useDcmsPlans();
  const { data: categories } = useVehicleCategories();
  const { data: seatCategories } = useSeatCategories();
  const { create, update } = useDcmsPlanMutations();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    includedCleanings: "30",
    includedWashes: "2",
    weeklyOffs: "4",
    vehicleCategoryId: "",
    seatPricingTier: "",
  });

  const resolveSeatCategoryId = (tier: string) => {
    const opt = SEAT_TIER_OPTIONS.find(t => t.value === tier);
    return seatCategories?.find(s => s.slug === opt?.slug)?.id;
  };

  const handleCreate = async () => {
    const seatCategoryId = resolveSeatCategoryId(form.seatPricingTier);
    if (!form.vehicleCategoryId || !seatCategoryId) {
      toast({ title: "Select car type and seater tier", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ ...form, seatCategoryId: String(seatCategoryId) });
      setOpen(false);
      toast({ title: "Plan created" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      await update.mutateAsync({ id, isActive: !isActive });
      toast({ title: isActive ? "Plan deactivated" : "Plan activated" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-display font-bold text-xl">Subscription Plans</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Plans are priced per car type and seater tier (up to 5 vs 5+) — wash/clean count sets the bundle.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Plan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Plan</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Car Type</Label>
                  <Select value={form.vehicleCategoryId} onValueChange={v => setForm(f => ({ ...f, vehicleCategoryId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select car type" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Seater Tier</Label>
                  <Select value={form.seatPricingTier} onValueChange={v => setForm(f => ({ ...f, seatPricingTier: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select seater tier" /></SelectTrigger>
                    <SelectContent>
                      {SEAT_TIER_OPTIONS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Daily Clean + 2 Wash" /></div>
                <div><Label>Price (₹)</Label><Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
                <div><Label>Included Cleanings</Label><Input type="number" value={form.includedCleanings} onChange={e => setForm(f => ({ ...f, includedCleanings: e.target.value }))} /></div>
                <div><Label>Included Washes</Label><Input type="number" value={form.includedWashes} onChange={e => setForm(f => ({ ...f, includedWashes: e.target.value }))} /></div>
                <div><Label>Weekly Offs</Label><Input type="number" value={form.weeklyOffs} onChange={e => setForm(f => ({ ...f, weeklyOffs: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={create.isPending} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <p>Loading...</p> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans?.map(plan => (
              <Card key={plan.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <Switch checked={plan.isActive} onCheckedChange={() => toggleActive(plan.id, plan.isActive)} />
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="text-2xl font-bold">₹{Number(plan.price).toLocaleString("en-IN")}</p>
                  {plan.vehicleCategoryName && (plan.seatPricingTierLabel || plan.seatCategoryName) && (
                    <p className="text-xs font-medium text-primary">
                      {plan.vehicleCategoryName} · {plan.seatPricingTierLabel ?? plan.seatCategoryName}
                    </p>
                  )}
                  <p>{plan.includedCleanings} cleanings · {plan.includedWashes} washes</p>
                  <p className="text-muted-foreground">{plan.weeklyOffs} weekly offs included</p>
                  {!plan.vehicleCategoryId && (
                    <p className="text-xs text-amber-600 mt-2">Legacy plan — link car type before new subscriptions</p>
                  )}
                  {plan.hasSubscriptions && <p className="text-xs text-amber-600 mt-2">Has subscriptions — cannot delete</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
