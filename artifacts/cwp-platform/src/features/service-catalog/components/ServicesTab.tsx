import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useServiceCategories } from "@/features/master-data/api";
import {
  useAdminServices, useServiceMutations, type AdminService,
} from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Wrench, IndianRupee, Clock } from "lucide-react";

const PRICING_MODELS = [
  { value: "fixed", label: "Fixed Price" },
  { value: "vehicle_matrix", label: "Vehicle Matrix (by category/seats)" },
  { value: "solar_slab", label: "Solar Slab (per panel)" },
] as const;

const emptyForm = () => ({
  name: "",
  description: "",
  shortDescription: "",
  serviceCategoryId: "",
  pricingModel: "fixed" as AdminService["pricingModel"],
  basePrice: "",
  gstRate: "18",
  pricingType: "inclusive" as AdminService["pricingType"],
  durationMinutes: "",
  imageUrl: "",
  isActive: true,
  status: "active" as AdminService["status"],
  assignmentStrategy: "manual" as AdminService["assignmentStrategy"],
});

function serviceToForm(s: AdminService) {
  return {
    name: s.name,
    description: s.description ?? "",
    shortDescription: s.shortDescription ?? "",
    serviceCategoryId: s.serviceCategoryId ? String(s.serviceCategoryId) : "",
    pricingModel: s.pricingModel ?? "fixed",
    basePrice: String(s.basePrice ?? ""),
    gstRate: String(s.gstRate ?? "18"),
    pricingType: s.pricingType ?? "inclusive",
    durationMinutes: s.durationMinutes ? String(s.durationMinutes) : "",
    imageUrl: s.imageUrl ?? "",
    isActive: s.isActive !== false,
    status: s.status ?? "active",
    assignmentStrategy: s.assignmentStrategy ?? "manual",
  };
}

function pricingModelLabel(model?: string) {
  return PRICING_MODELS.find(m => m.value === model)?.label ?? model ?? "Fixed";
}

export function ServicesTab() {
  const { toast } = useToast();
  const { data: services, isLoading } = useAdminServices();
  const { data: categories } = useServiceCategories();
  const { create, update, remove } = useServiceMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [form, setForm] = useState(emptyForm());

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (svc: AdminService) => {
    setEditing(svc);
    setForm(serviceToForm(svc));
    setDialogOpen(true);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    shortDescription: form.shortDescription.trim() || undefined,
    serviceCategoryId: form.serviceCategoryId ? parseInt(form.serviceCategoryId) : undefined,
    pricingModel: form.pricingModel,
    basePrice: parseFloat(form.basePrice),
    gstRate: parseFloat(form.gstRate) || 18,
    pricingType: form.pricingType,
    durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    isActive: form.isActive,
    status: form.status,
    assignmentStrategy: form.assignmentStrategy,
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.basePrice) {
      toast({ title: "Name and base price are required", variant: "destructive" });
      return;
    }
    if (!form.serviceCategoryId) {
      toast({ title: "Select a service category", variant: "destructive" });
      return;
    }

    const payload = buildPayload();
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => {
          setDialogOpen(false);
          toast({ title: "Service updated" });
        },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          setDialogOpen(false);
          toast({ title: "Service created" });
        },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    }
  };

  const handleDelete = (svc: AdminService) => {
    if (!confirm(`Archive "${svc.name}"? It will be hidden from booking.`)) return;
    remove.mutate(svc.id, {
      onSuccess: () => toast({ title: "Service archived" }),
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const isSaving = create.isPending || update.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>
            Manage bookable services — category, pricing model, GST, and availability
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1" />Add Service
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : (services ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No services yet. Add your first service.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(services ?? []).map(svc => (
              <div
                key={svc.id}
                className={`border rounded-xl p-4 space-y-3 ${!svc.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench size={14} className="text-primary" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(svc)}>
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(svc)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm">{svc.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {svc.shortDescription || svc.description || "—"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    {svc.categoryName ?? svc.category?.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {pricingModelLabel(svc.pricingModel)}
                  </Badge>
                  {!svc.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <IndianRupee size={13} />{Number(svc.basePrice).toLocaleString("en-IN")}
                  </span>
                  {svc.durationMinutes && (
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <Clock size={12} />{svc.durationMinutes} min
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Service Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>

            <div>
              <Label>Category *</Label>
              <Select value={form.serviceCategoryId} onValueChange={v => setForm(f => ({ ...f, serviceCategoryId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pricing Model</Label>
              <Select value={form.pricingModel} onValueChange={v => setForm(f => ({ ...f, pricingModel: v as AdminService["pricingModel"] }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICING_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.pricingModel === "vehicle_matrix" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Price comes from Master Data → vehicle matrix. Base price is fallback only.
                </p>
              )}
              {form.pricingModel === "solar_slab" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Configure panel slabs in the Solar Slabs tab.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Base Price (₹) *</Label>
                <Input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GST Rate (%)</Label>
                <Input type="number" value={form.gstRate} onChange={e => setForm(f => ({ ...f, gstRate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>GST Mode</Label>
                <Select value={form.pricingType} onValueChange={v => setForm(f => ({ ...f, pricingType: v as AdminService["pricingType"] }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inclusive">Inclusive</SelectItem>
                    <SelectItem value="exclusive">Exclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Short Description</Label>
              <Input value={form.shortDescription} onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))} className="mt-1" placeholder="Shown on cards" />
            </div>

            <div>
              <Label>Full Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={3} />
            </div>

            <div>
              <Label>Image URL</Label>
              <Input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="mt-1" placeholder="https://..." />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Show in booking & website</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : editing ? "Update Service" : "Create Service"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
