import { useMemo, useState } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useServiceCategories } from "@/features/master-data/api";
import {
  useAdminServices, useServiceMutations, type AdminService,
} from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";
import { useCatalogGovernance } from "@/lib/catalogGovernance";
import { ServiceAddonsSection } from "@/features/service-catalog/components/ServiceAddonsSection";
import { ImageDropzone } from "@/components/shared/ImageDropzone";
import { resolveMediaUrl } from "@/lib/media-url";
import { Plus, Pencil, Trash2, Wrench, IndianRupee, Clock, Puzzle, ChevronDown } from "lucide-react";

type RevenueLine = "car_wash" | "solar";

type Props = {
  revenueLine: RevenueLine;
};

function resolveCategoryId(
  categories: Array<{ id: number; slug: string }> | undefined,
  revenueLine: RevenueLine,
): number | undefined {
  const slug = revenueLine === "solar" ? "solar-cleaning" : "doorstep-car-wash";
  return categories?.find(c => c.slug === slug)?.id ?? categories?.[0]?.id;
}

function matchesRevenueLine(svc: AdminService, revenueLine: RevenueLine): boolean {
  const cat = (svc.category ?? "").toLowerCase();
  const slug = (svc.categorySlug ?? "").toLowerCase();
  if (revenueLine === "solar") {
    return cat.includes("solar") || slug.includes("solar");
  }
  return !cat.includes("solar") && !slug.includes("solar") && cat !== "subscription";
}

const emptyForm = () => ({
  name: "",
  description: "",
  shortDescription: "",
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

function ServiceCard({
  svc,
  hqEditor,
  onEdit,
  onDelete,
}: {
  svc: AdminService;
  hqEditor: boolean;
  onEdit: (svc: AdminService) => void;
  onDelete: (svc: AdminService) => void;
}) {
  const inactive = svc.isActive === false;
  return (
    <div className={`border rounded-xl p-4 space-y-3 ${inactive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        {svc.imageUrl ? (
          <img
            src={resolveMediaUrl(svc.imageUrl)}
            alt=""
            className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Wrench size={14} className="text-primary" />
          </div>
        )}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(svc)}>
            <Pencil size={13} />
          </Button>
          {hqEditor && (
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(svc)}
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm">{svc.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {svc.shortDescription || svc.description || "—"}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {inactive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
        {(svc.addonCount ?? 0) > 0 && (
          <Badge variant="outline" className="text-xs gap-0.5">
            <Puzzle size={10} />{svc.addonCount} extra{svc.addonCount !== 1 ? "s" : ""}
          </Badge>
        )}
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
  );
}

export function ServicesTab({ revenueLine }: Props) {
  const { toast } = useToast();
  const { hqEditor, availabilityOnly } = useCatalogGovernance();
  const { data: services, isLoading } = useAdminServices();
  const { data: categories } = useServiceCategories();
  const { create, update, remove } = useServiceMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [inactiveOpen, setInactiveOpen] = useState(false);

  const filtered = useMemo(
    () => (services ?? []).filter(s => matchesRevenueLine(s, revenueLine)),
    [services, revenueLine],
  );
  const activeServices = useMemo(
    () => filtered.filter(s => s.isActive !== false),
    [filtered],
  );
  const inactiveServices = useMemo(
    () => filtered.filter(s => s.isActive === false),
    [filtered],
  );

  const defaultCategoryId = resolveCategoryId(categories, revenueLine);
  const defaultPricingModel = revenueLine === "solar" ? "solar_slab" as const : "vehicle_matrix" as const;

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
    serviceCategoryId: editing?.serviceCategoryId ?? defaultCategoryId,
    pricingModel: editing?.pricingModel ?? defaultPricingModel,
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
    if (!editing && availabilityOnly) {
      toast({ title: "Contact HQ to add new products", variant: "destructive" });
      return;
    }
    if (!availabilityOnly && (!form.name.trim() || !form.basePrice)) {
      toast({ title: "Name and price are required", variant: "destructive" });
      return;
    }
    if (!defaultCategoryId && !editing?.serviceCategoryId && !availabilityOnly) {
      toast({ title: "Catalog not configured — contact HQ", variant: "destructive" });
      return;
    }

    if (editing) {
      update.mutate(
        availabilityOnly
          ? { id: editing.id, isActive: form.isActive, status: form.status }
          : { id: editing.id, ...buildPayload() },
        {
          onSuccess: () => toast({ title: availabilityOnly ? "Availability updated" : "Service updated" }),
          onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
        },
      );
    } else {
      create.mutate(buildPayload(), {
        onSuccess: (created) => {
          setEditing(created as AdminService);
          toast({ title: "Service created — add optional extras below if needed" });
        },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    }
  };

  const handleDelete = (svc: AdminService) => {
    if (!confirm(`Hide "${svc.name}" from booking?`)) return;
    remove.mutate(svc.id, {
      onSuccess: () => toast({ title: "Service hidden" }),
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const isSaving = create.isPending || update.isPending;
  const priceHint = revenueLine === "solar"
    ? availabilityOnly
      ? "Price set by HQ."
      : "Display or minimum price — final amount quoted at booking."
    : availabilityOnly
      ? "Price set by HQ."
      : "List price — may vary by car type when booking.";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>
            {revenueLine === "solar"
              ? "One-time solar cleaning product"
              : "One-time wash and detailing services customers can book"}
          </CardDescription>
        </div>
        {hqEditor && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1" />Add service
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No services yet. Add your first service.</p>
        ) : (
          <>
            {activeServices.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No active services. Open Hidden below to reactivate one.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activeServices.map(svc => (
                  <ServiceCard
                    key={svc.id}
                    svc={svc}
                    hqEditor={hqEditor}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {inactiveServices.length > 0 && (
              <Collapsible open={inactiveOpen} onOpenChange={setInactiveOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
                  <span>
                    Hidden ({inactiveServices.length} inactive)
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${inactiveOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {inactiveServices.map(svc => (
                      <ServiceCard
                        key={svc.id}
                        svc={svc}
                        hqEditor={hqEditor}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={open => {
        setDialogOpen(open);
        if (!open) { setEditing(null); setForm(emptyForm()); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {availabilityOnly ? "Service availability" : editing ? "Edit service" : "New service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {availabilityOnly && editing && (
              <p className="text-sm text-muted-foreground rounded-lg border p-3 bg-muted/30">
                Prices and product details are set by HQ. You can turn this service on or off for your branch.
              </p>
            )}
            <div>
              <Label>Service name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" disabled={availabilityOnly} />
            </div>

            {!availabilityOnly && (
            <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (₹) *</Label>
                <Input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">{priceHint}</p>
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GST rate (%)</Label>
                <Input type="number" value={form.gstRate} onChange={e => setForm(f => ({ ...f, gstRate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>GST mode</Label>
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
              <Label>Short description</Label>
              <Input value={form.shortDescription} onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))} className="mt-1" placeholder="Shown on cards" />
            </div>

            <div>
              <Label>Full description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={3} />
            </div>

            <ImageDropzone
              value={form.imageUrl}
              onChange={url => setForm(f => ({ ...f, imageUrl: url }))}
              label="Service image"
            />
            </>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Available for booking</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>

            {editing && hqEditor && (
              <ServiceAddonsSection serviceId={editing.id} serviceName={editing.name} />
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : availabilityOnly ? "Save availability" : editing ? "Update service" : "Create service"}
              </Button>
              {editing && (
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Done</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
