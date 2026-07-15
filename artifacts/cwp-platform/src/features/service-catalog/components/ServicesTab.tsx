import { useMemo, useState, type ReactNode } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useServiceCategories } from "@/features/master-data/api";
import {
  useAdminServices, useServiceMutations, type AdminService,
} from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";
import { useCatalogGovernance } from "@/lib/catalogGovernance";
import { ServiceAddonsSection } from "@/features/service-catalog/components/ServiceAddonsSection";
import { ImageDropzone } from "@/components/shared/ImageDropzone";
import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Wrench, IndianRupee, Clock, Puzzle, ChevronDown,
  Search, EyeOff, PackageSearch,
} from "lucide-react";

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

function IconActionButton({
  label,
  variant = "ghost",
  onClick,
  children,
}: {
  label: string;
  variant?: "ghost" | "destructive-ghost";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "h-8 w-8 text-muted-foreground",
            variant === "destructive-ghost" && "hover:text-destructive hover:bg-destructive/10",
            variant === "ghost" && "hover:text-foreground hover:bg-muted",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
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
    <div
      className={cn(
        "group relative border rounded-xl p-4 flex flex-col gap-3 bg-card transition-all",
        "hover:border-primary/40 hover:shadow-md",
        inactive && "border-dashed bg-muted/20",
      )}
    >
      <div className="flex items-start gap-3">
        {svc.imageUrl ? (
          <img
            src={resolveMediaUrl(svc.imageUrl)}
            alt=""
            className={cn("w-14 h-14 rounded-lg object-cover border border-border shrink-0", inactive && "grayscale opacity-70")}
          />
        ) : (
          <div className={cn(
            "w-14 h-14 rounded-lg flex items-center justify-center shrink-0",
            inactive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}>
            <Wrench size={20} />
          </div>
        )}

        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-semibold text-sm leading-snug truncate">{svc.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {svc.shortDescription || svc.description || "No description added"}
          </p>
        </div>

        <div className="flex gap-0.5 -mt-1 -mr-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          <IconActionButton label="Edit service" onClick={() => onEdit(svc)}>
            <Pencil size={14} />
          </IconActionButton>
          {hqEditor && (
            <IconActionButton label="Hide service" variant="destructive-ghost" onClick={() => onDelete(svc)}>
              <Trash2 size={14} />
            </IconActionButton>
          )}
        </div>
      </div>

      {(inactive || (svc.addonCount ?? 0) > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {inactive && (
            <Badge variant="outline" className="text-xs gap-1 border-muted-foreground/30 text-muted-foreground">
              <EyeOff size={10} /> Hidden from booking
            </Badge>
          )}
          {(svc.addonCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Puzzle size={10} />{svc.addonCount} extra{svc.addonCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm pt-2 mt-auto border-t border-border/60">
        <span className="flex items-center gap-0.5 font-bold text-primary text-base pt-2">
          <IndianRupee size={14} />{Number(svc.basePrice).toLocaleString("en-IN")}
        </span>
        {svc.durationMinutes ? (
          <span className="flex items-center gap-1 text-muted-foreground text-xs pt-2">
            <Clock size={12} />{svc.durationMinutes} min
          </span>
        ) : null}
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
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => (services ?? []).filter(s => matchesRevenueLine(s, revenueLine)),
    [services, revenueLine],
  );
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.shortDescription ?? "").toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q),
    );
  }, [filtered, query]);
  const activeServices = useMemo(
    () => searched.filter(s => s.isActive !== false),
    [searched],
  );
  const inactiveServices = useMemo(
    () => searched.filter(s => s.isActive === false),
    [searched],
  );
  const showSearch = filtered.length > 6;

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
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Services
            {filtered.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                &middot; {activeServices.length} active{inactiveServices.length > 0 ? `, ${inactiveServices.length} hidden` : ""}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {revenueLine === "solar"
              ? "One-time solar cleaning product"
              : "One-time wash and detailing services customers can book"}
          </CardDescription>
        </div>
        {hqEditor && (
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus size={14} className="mr-1" />Add service
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showSearch && (
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-8 h-9"
            />
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-10">
            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
              <Wrench size={18} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No services yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {hqEditor ? "Add your first service so branches can start booking it." : "HQ hasn't added any services to this catalog yet."}
            </p>
            {hqEditor && (
              <Button size="sm" variant="outline" className="mt-1" onClick={openCreate}>
                <Plus size={14} className="mr-1" />Add service
              </Button>
            )}
          </div>
        ) : searched.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-10">
            <PackageSearch size={28} className="text-muted-foreground" />
            <p className="text-sm font-medium">No matches for "{query}"</p>
            <Button size="sm" variant="ghost" onClick={() => setQuery("")}>Clear search</Button>
          </div>
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
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                  <span className="flex items-center gap-2 font-medium">
                    <EyeOff size={14} />
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
