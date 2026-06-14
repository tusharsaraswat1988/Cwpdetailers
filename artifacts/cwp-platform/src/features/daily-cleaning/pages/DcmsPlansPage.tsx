import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { useDcmsPlans, useDcmsPlanMutations, type DcmsPlan } from "../api";
import { useVehicleCategories, useSeatCategories } from "@/features/master-data/api";
import { useCatalogAddons } from "@/features/service-catalog/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";

const SEAT_TIER_OPTIONS = [
  { value: "standard" as const, label: "Up to 5 Seater", slug: "5-seater" },
  { value: "large" as const, label: "5+ Seater", slug: "7-seater" },
];

type PlanAddonForm = {
  addonId: number;
  addonName: string;
  basePrice: string;
  enabled: boolean;
  includedCleanings: string;
  includedWashes: string;
  extraPrice: string;
};

type PlanForm = {
  name: string;
  description: string;
  price: string;
  includedCleanings: string;
  includedWashes: string;
  weeklyOffs: string;
  allVehicleCategories: boolean;
  vehicleCategoryIds: number[];
  allSeatTiers: boolean;
  seatPricingTiers: Array<"standard" | "large">;
  addons: PlanAddonForm[];
};

const emptyForm = (): PlanForm => ({
  name: "",
  description: "",
  price: "",
  includedCleanings: "26",
  includedWashes: "0",
  weeklyOffs: "4",
  allVehicleCategories: false,
  vehicleCategoryIds: [],
  allSeatTiers: false,
  seatPricingTiers: [],
  addons: [],
});

function addonPriceTotal(addons: PlanAddonForm[]): number {
  return addons
    .filter(a => a.enabled)
    .reduce((sum, a) => sum + Number(a.extraPrice || a.basePrice || 0), 0);
}

export default function DcmsPlansPage() {
  const { data: plans, isPending, isError, error, refetch } = useDcmsPlans();
  const { data: categories } = useVehicleCategories();
  const { data: seatCategories } = useSeatCategories();
  const { data: catalogAddons } = useCatalogAddons();
  const { create, update, remove } = useDcmsPlanMutations();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DcmsPlan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm());

  const resolveSeatCategoryId = (tier: "standard" | "large") => {
    const opt = SEAT_TIER_OPTIONS.find(t => t.value === tier);
    return seatCategories?.find(s => s.slug === opt?.slug)?.id;
  };

  const buildAddonForms = (plan?: DcmsPlan | null): PlanAddonForm[] => {
    const selected = new Map(
      (plan?.addons ?? []).map(a => [a.addonId, a]),
    );
    return (catalogAddons ?? []).map(a => {
      const linked = selected.get(a.id);
      return {
        addonId: a.id,
        addonName: a.name,
        basePrice: a.basePrice,
        enabled: Boolean(linked),
        includedCleanings: String(linked?.includedCleanings ?? 0),
        includedWashes: String(linked?.includedWashes ?? 0),
        extraPrice: linked?.extraPrice ?? "",
      };
    });
  };

  const planToForm = (plan: DcmsPlan): PlanForm => {
    const addonCleanings = plan.addons?.reduce((s, a) => s + a.includedCleanings, 0) ?? 0;
    const addonWashes = plan.addons?.reduce((s, a) => s + a.includedWashes, 0) ?? 0;
    const addonPrice = plan.addons?.reduce(
      (s, a) => s + Number(a.extraPrice ?? a.addonBasePrice ?? 0),
      0,
    ) ?? 0;

    let seatPricingTiers: Array<"standard" | "large"> = [];
    if (!plan.seatCategoryId) {
      seatPricingTiers = [];
    } else if (plan.seatPricingTier) {
      seatPricingTiers = [plan.seatPricingTier];
    } else {
      const seat = seatCategories?.find(s => s.id === plan.seatCategoryId);
      const tier = SEAT_TIER_OPTIONS.find(t => t.slug === seat?.slug)?.value;
      if (tier) seatPricingTiers = [tier];
    }

    return {
      name: plan.name,
      description: plan.description ?? "",
      price: String(Math.max(0, Number(plan.price) - addonPrice)),
      includedCleanings: String(Math.max(0, plan.includedCleanings - addonCleanings)),
      includedWashes: String(Math.max(0, plan.includedWashes - addonWashes)),
      weeklyOffs: String(plan.weeklyOffs),
      allVehicleCategories: !plan.vehicleCategoryId,
      vehicleCategoryIds: plan.vehicleCategoryId ? [plan.vehicleCategoryId] : [],
      allSeatTiers: !plan.seatCategoryId,
      seatPricingTiers,
      addons: buildAddonForms(plan),
    };
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), addons: buildAddonForms() });
    setDialogOpen(true);
  };

  const openEdit = (plan: DcmsPlan) => {
    setEditing(plan);
    setForm(planToForm(plan));
    setDialogOpen(true);
  };

  const toggleVehicleCategory = (id: number, checked: boolean) => {
    setForm(f => ({
      ...f,
      allVehicleCategories: false,
      vehicleCategoryIds: checked
        ? [...f.vehicleCategoryIds, id]
        : f.vehicleCategoryIds.filter(x => x !== id),
    }));
  };

  const toggleSeatTier = (tier: "standard" | "large", checked: boolean) => {
    setForm(f => ({
      ...f,
      allSeatTiers: false,
      seatPricingTiers: checked
        ? [...f.seatPricingTiers, tier]
        : f.seatPricingTiers.filter(x => x !== tier),
    }));
  };

  const toggleAddon = (addonId: number, enabled: boolean) => {
    setForm(f => ({
      ...f,
      addons: f.addons.map(a => (a.addonId === addonId ? { ...a, enabled } : a)),
    }));
  };

  const updateAddonField = (addonId: number, field: keyof PlanAddonForm, value: string) => {
    setForm(f => ({
      ...f,
      addons: f.addons.map(a => (a.addonId === addonId ? { ...a, [field]: value } : a)),
    }));
  };

  const validateScope = () => {
    const hasVehicle = form.allVehicleCategories || form.vehicleCategoryIds.length > 0;
    const hasSeat = form.allSeatTiers || form.seatPricingTiers.length > 0;
    if (!hasVehicle || !hasSeat) {
      toast({ title: "Select car type and seater tier (or choose All)", variant: "destructive" });
      return false;
    }
    return true;
  };

  const buildAddonsPayload = () =>
    form.addons
      .filter(a => a.enabled)
      .map((a, i) => ({
        addonId: a.addonId,
        includedCleanings: Number(a.includedCleanings || 0),
        includedWashes: Number(a.includedWashes || 0),
        extraPrice: a.extraPrice.trim() ? a.extraPrice : null,
        sortOrder: i,
      }));

  const handleSave = async () => {
    if (!validateScope()) return;
    if (!form.name.trim() || !form.price) {
      toast({ title: "Name and price are required", variant: "destructive" });
      return;
    }

    const basePayload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: form.price,
      includedCleanings: form.includedCleanings,
      includedWashes: form.includedWashes,
      weeklyOffs: form.weeklyOffs,
      addons: buildAddonsPayload(),
    };

    try {
      if (editing) {
        const seatCategoryId = form.allSeatTiers
          ? null
          : resolveSeatCategoryId(form.seatPricingTiers[0]!);
        await update.mutateAsync({
          id: editing.id,
          ...basePayload,
          allVehicleCategories: form.allVehicleCategories,
          vehicleCategoryId: form.allVehicleCategories ? null : form.vehicleCategoryIds[0],
          allSeatTiers: form.allSeatTiers,
          seatCategoryId,
        });
        toast({ title: "Plan updated" });
      } else {
        const result = await create.mutateAsync({
          ...basePayload,
          allVehicleCategories: form.allVehicleCategories,
          vehicleCategoryIds: form.allVehicleCategories ? undefined : form.vehicleCategoryIds,
          allSeatTiers: form.allSeatTiers,
          seatPricingTiers: form.allSeatTiers ? undefined : form.seatPricingTiers,
        });
        const count = "count" in result ? result.count : 1;
        toast({ title: count > 1 ? `Created ${count} plans` : "Plan created" });
      }
      setDialogOpen(false);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (plan: DcmsPlan) => {
    if (plan.hasSubscriptions) {
      toast({
        title: "Cannot delete",
        description: "This plan has active subscriptions. Deactivate it instead.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`Delete "${plan.name}"? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync(plan.id);
      toast({ title: "Plan deleted" });
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

  const isSaving = create.isPending || update.isPending;
  const selectedAddonTotal = addonPriceTotal(form.addons);
  const displayTotalPrice = Number(form.price || 0) + selectedAddonTotal;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-display font-bold text-xl">Subscription Plans</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create plans for multiple car types and seater tiers. Bundle service-catalog add-ons with clean/wash counts.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create Plan
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Plan" : "New Plan"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Car Type</Label>
                <div className="rounded-md border p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Checkbox
                      checked={form.allVehicleCategories}
                      onCheckedChange={v => setForm(f => ({
                        ...f,
                        allVehicleCategories: Boolean(v),
                        vehicleCategoryIds: v ? [] : f.vehicleCategoryIds,
                      }))}
                    />
                    All Car Types
                  </label>
                  {!form.allVehicleCategories && categories?.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.vehicleCategoryIds.includes(c.id)}
                        onCheckedChange={v => toggleVehicleCategory(c.id, Boolean(v))}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Seater Tier</Label>
                <div className="rounded-md border p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Checkbox
                      checked={form.allSeatTiers}
                      onCheckedChange={v => setForm(f => ({
                        ...f,
                        allSeatTiers: Boolean(v),
                        seatPricingTiers: v ? [] : f.seatPricingTiers,
                      }))}
                    />
                    All Seater Tiers
                  </label>
                  {!form.allSeatTiers && SEAT_TIER_OPTIONS.map(t => (
                    <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.seatPricingTiers.includes(t.value)}
                        onCheckedChange={v => toggleSeatTier(t.value, Boolean(v))}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
                {!editing && !form.allVehicleCategories && !form.allSeatTiers
                  && form.vehicleCategoryIds.length > 1 && form.seatPricingTiers.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Will create {form.vehicleCategoryIds.length * form.seatPricingTiers.length} plan variants.
                  </p>
                )}
              </div>

              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Daily Clean + 2 Wash" /></div>
              <div><Label>Base Price (₹)</Label><Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><Label>Included Cleanings</Label><Input type="number" value={form.includedCleanings} onChange={e => setForm(f => ({ ...f, includedCleanings: e.target.value }))} /></div>
              <div><Label>Included Washes</Label><Input type="number" value={form.includedWashes} onChange={e => setForm(f => ({ ...f, includedWashes: e.target.value }))} /></div>
              <div><Label>Weekly Offs</Label><Input type="number" value={form.weeklyOffs} onChange={e => setForm(f => ({ ...f, weeklyOffs: e.target.value }))} /></div>

              <div className="space-y-2">
                <Label>Add-ons (from Service Catalog)</Label>
                <p className="text-xs text-muted-foreground">
                  Select add-ons to bundle with this plan. Set included cleanings/washes per add-on like the base plan.
                </p>
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                  {form.addons.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No add-ons in catalog yet.</p>
                  ) : form.addons.map(a => (
                    <div key={a.addonId} className="p-3 space-y-2">
                      <label className="flex items-center justify-between gap-2 cursor-pointer">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={a.enabled} onCheckedChange={v => toggleAddon(a.addonId, Boolean(v))} />
                          {a.addonName}
                        </span>
                        <span className="text-xs text-muted-foreground">₹{Number(a.basePrice).toLocaleString("en-IN")}</span>
                      </label>
                      {a.enabled && (
                        <div className="grid grid-cols-3 gap-2 pl-6">
                          <div>
                            <Label className="text-xs">Cleanings</Label>
                            <Input
                              type="number"
                              className="h-8"
                              value={a.includedCleanings}
                              onChange={e => updateAddonField(a.addonId, "includedCleanings", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Washes</Label>
                            <Input
                              type="number"
                              className="h-8"
                              value={a.includedWashes}
                              onChange={e => updateAddonField(a.addonId, "includedWashes", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Extra ₹</Label>
                            <Input
                              className="h-8"
                              placeholder={a.basePrice}
                              value={a.extraPrice}
                              onChange={e => updateAddonField(a.addonId, "extraPrice", e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {selectedAddonTotal > 0 && (
                  <p className="text-sm">
                    Customer price: <span className="font-semibold">₹{displayTotalPrice.toLocaleString("en-IN")}</span>
                    <span className="text-muted-foreground text-xs ml-1">(base + add-ons)</span>
                  </p>
                )}
              </div>

              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {editing ? "Save Changes" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {isPending ? <p>Loading...</p> : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2">
            <p className="font-medium text-destructive">Could not load plans</p>
            <p className="text-muted-foreground">{(error as Error).message}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : !plans?.length ? (
          <p className="text-sm text-muted-foreground">No plans yet. Create one or run the DCMS plan migration script.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans?.map(plan => (
              <Card key={plan.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base leading-snug">{plan.name}</CardTitle>
                    <Switch checked={plan.isActive} onCheckedChange={() => toggleActive(plan.id, plan.isActive)} />
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="text-2xl font-bold">₹{Number(plan.price).toLocaleString("en-IN")}</p>
                  <p className="text-xs font-medium text-primary">
                    {plan.scopeVehicleLabel ?? plan.vehicleCategoryName ?? "All Car Types"}
                    {" · "}
                    {plan.scopeSeatLabel ?? plan.seatPricingTierLabel ?? plan.seatCategoryName ?? "All Seater Tiers"}
                  </p>
                  <p>{plan.includedCleanings} cleanings · {plan.includedWashes} washes</p>
                  {plan.addons && plan.addons.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      + {plan.addons.map(a => a.addonName).join(", ")}
                    </p>
                  )}
                  <p className="text-muted-foreground">{plan.weeklyOffs} weekly offs included</p>
                  {plan.hasSubscriptions && (
                    <p className="text-xs text-amber-600 mt-2">Has subscriptions — cannot delete</p>
                  )}
                </CardContent>
                <CardFooter className="gap-2 pt-0">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(plan)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={plan.hasSubscriptions || remove.isPending}
                    onClick={() => handleDelete(plan)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
