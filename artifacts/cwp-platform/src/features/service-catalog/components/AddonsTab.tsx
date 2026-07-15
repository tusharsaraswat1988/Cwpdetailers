import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAdminServices,
  useCatalogAddons,
  useCatalogAddonMutations,
  type ServiceAddon,
} from "@/features/service-catalog/api";
import { useCatalogGovernance } from "@/lib/catalogGovernance";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus } from "lucide-react";

type AddonForm = {
  name: string;
  basePrice: string;
  description: string;
  durationMinutes: string;
  serviceIds: number[];
  isActive: boolean;
};

const emptyForm = (): AddonForm => ({
  name: "",
  basePrice: "",
  description: "",
  durationMinutes: "",
  serviceIds: [],
  isActive: true,
});

function addonToForm(addon: ServiceAddon): AddonForm {
  return {
    name: addon.name,
    basePrice: String(addon.basePrice),
    description: addon.description ?? "",
    durationMinutes: addon.durationMinutes ? String(addon.durationMinutes) : "",
    serviceIds: (addon.links ?? [])
      .map(l => l.serviceId)
      .filter((id): id is number => id != null),
    isActive: addon.isActive,
  };
}

export function AddonsTab() {
  const { toast } = useToast();
  const { hqEditor } = useCatalogGovernance();
  const { data: addons, isLoading } = useCatalogAddons(undefined, { includeInactive: true, withLinks: true });
  const { data: services } = useAdminServices();
  const { create, update, link, unlink } = useCatalogAddonMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceAddon | null>(null);
  const [form, setForm] = useState<AddonForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const linkableServices = useMemo(() => {
    return (services ?? []).filter(s => {
      const status = s.status ?? (s.isActive === false ? "disabled" : "active");
      return status !== "archived";
    });
  }, [services]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (addon: ServiceAddon) => {
    setEditing(addon);
    setForm(addonToForm(addon));
    setDialogOpen(true);
  };

  const toggleService = (serviceId: number, checked: boolean) => {
    setForm(f => ({
      ...f,
      serviceIds: checked
        ? [...new Set([...f.serviceIds, serviceId])]
        : f.serviceIds.filter(id => id !== serviceId),
    }));
  };

  const syncServiceLinks = async (addonId: number, desiredIds: number[], existing: ServiceAddon | null) => {
    const currentLinks = existing?.links ?? [];
    const currentByService = new Map(
      currentLinks
        .filter(l => l.serviceId != null)
        .map(l => [l.serviceId as number, l.linkId]),
    );
    const desired = new Set(desiredIds);

    for (const [serviceId, linkId] of currentByService) {
      if (!desired.has(serviceId)) {
        await unlink.mutateAsync(linkId);
      }
    }
    for (const serviceId of desiredIds) {
      if (!currentByService.has(serviceId)) {
        await link.mutateAsync({ addonId, serviceId });
      }
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.basePrice) {
      toast({ title: "Name and price required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        basePrice: form.basePrice,
        description: form.description.trim() || undefined,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes, 10) : undefined,
        isActive: form.isActive,
      };

      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        await syncServiceLinks(editing.id, form.serviceIds, editing);
        toast({ title: "Add-on updated" });
      } else {
        await create.mutateAsync({
          ...payload,
          serviceIds: form.serviceIds,
        });
        toast({ title: "Add-on created" });
      }
      setDialogOpen(false);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h2 className="font-display font-bold text-lg">Add-ons</h2>
          <p className="text-sm text-muted-foreground">
            Shared extras (wax, vacuum, etc.) — link them to one-time services for booking upsells, or bundle into packages and daily cleaning plans.
          </p>
        </div>
        {hqEditor && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1" /> New add-on
          </Button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit add-on" : "New add-on"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Car Waxing" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (₹)</Label>
                <Input className="mt-1" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" className="mt-1" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input className="mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: Boolean(v) }))} />
              Active in catalog
            </label>

            <div className="space-y-2">
              <Label>Link to one-time services</Label>
              <p className="text-xs text-muted-foreground">
                Customers can pick this add-on when booking the selected services.
              </p>
              <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                {linkableServices.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No services available.</p>
                ) : (
                  linkableServices.map(s => (
                    <label key={s.id} className="flex items-center gap-2 p-2.5 text-sm cursor-pointer hover:bg-muted/40">
                      <Checkbox
                        checked={form.serviceIds.includes(s.id)}
                        onCheckedChange={v => toggleService(s.id, Boolean(v))}
                      />
                      <span className="flex-1 min-w-0 truncate">{s.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {s.categoryName || s.category}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving || !hqEditor}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create add-on"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading add-ons…</p>
      ) : !(addons ?? []).length ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No add-ons yet. Create wax, vacuum, tyre dressing, and other extras here, then link them to services or bundle them into packages.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(addons ?? []).map(addon => (
            <Card key={addon.id} className={!addon.isActive ? "opacity-60" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="text-base">{addon.name}</CardTitle>
                    <CardDescription>
                      ₹{Number(addon.basePrice).toLocaleString("en-IN")}
                      {addon.durationMinutes ? ` · ${addon.durationMinutes} min` : ""}
                    </CardDescription>
                  </div>
                  <Badge variant={addon.isActive ? "secondary" : "outline"} className="text-xs">
                    {addon.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {addon.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{addon.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {(addon.links ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">Not linked to any service</span>
                  ) : (
                    (addon.links ?? []).map(l => (
                      <Badge key={l.linkId} variant="outline" className="text-xs">
                        {l.serviceName ?? `Service #${l.serviceId}`}
                      </Badge>
                    ))
                  )}
                </div>
                {hqEditor && (
                  <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => openEdit(addon)}>
                    <Pencil size={14} className="mr-1" /> Edit & configure links
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
