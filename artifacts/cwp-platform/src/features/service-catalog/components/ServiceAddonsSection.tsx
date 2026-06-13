import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCatalogAddons, useServiceAddonMutations } from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

type Props = { serviceId: number; serviceName: string };

export function ServiceAddonsSection({ serviceId, serviceName }: Props) {
  const { toast } = useToast();
  const { data: addons, isLoading } = useCatalogAddons(serviceId);
  const { create, update, unlink } = useServiceAddonMutations(serviceId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", basePrice: "", description: "", durationMinutes: "" });

  const resetForm = () => {
    setForm({ name: "", basePrice: "", description: "", durationMinutes: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (addon: { id: number; name: string; basePrice: string; description?: string; durationMinutes?: number }) => {
    setEditingId(addon.id);
    setForm({
      name: addon.name,
      basePrice: String(addon.basePrice),
      description: addon.description ?? "",
      durationMinutes: addon.durationMinutes ? String(addon.durationMinutes) : "",
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.basePrice) {
      toast({ title: "Name and price required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      basePrice: form.basePrice,
      description: form.description.trim() || undefined,
      durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
    };

    if (editingId) {
      update.mutate({ id: editingId, ...payload }, {
        onSuccess: () => { resetForm(); toast({ title: "Addon updated" }); },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { resetForm(); toast({ title: "Addon added to service" }); },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    }
  };

  const handleRemove = (addon: { id: number; name: string; linkId?: number }) => {
    if (!addon.linkId) return;
    if (!confirm(`Remove "${addon.name}" from ${serviceName}?`)) return;
    unlink.mutate(addon.linkId, {
      onSuccess: () => toast({ title: "Addon removed from service" }),
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const handleToggle = (addon: { id: number; isActive: boolean }) => {
    update.mutate({ id: addon.id, isActive: !addon.isActive }, {
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const isSaving = create.isPending || update.isPending;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Add-ons</p>
          <p className="text-xs text-muted-foreground">Optional extras customers can add when booking this service</p>
        </div>
        {!showForm && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus size={13} className="mr-1" />Add
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading addons...</p>
      ) : (addons ?? []).length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground text-center py-2">No addons yet — e.g. Wax, Vacuum, Engine Bay Clean</p>
      ) : (
        <div className="space-y-2">
          {(addons ?? []).map(addon => (
            <div key={addon.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{addon.name}</p>
                {addon.description && (
                  <p className="text-xs text-muted-foreground truncate">{addon.description}</p>
                )}
              </div>
              <span className="font-semibold text-primary shrink-0">₹{addon.basePrice}</span>
              <Switch checked={addon.isActive} onCheckedChange={() => handleToggle(addon)} />
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(addon)}>
                <Pencil size={12} />
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(addon)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">
            {editingId ? "Edit addon" : "New addon for this service"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Wax Polish"
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Price (₹) *</Label>
              <Input
                type="number"
                value={form.basePrice}
                onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Duration (min)</Label>
              <Input
                type="number"
                value={form.durationMinutes}
                onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? "Saving..." : editingId ? "Update" : "Add Addon"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
