import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCatalogPackages, usePackageMutations, type CatalogPackage } from "@/features/service-catalog/api";
import { HomepagePlanToggle } from "./HomepagePlanToggle";
import { useToast } from "@/hooks/use-toast";
import { useCatalogGovernance } from "@/lib/catalogGovernance";
import { Plus, Pencil } from "lucide-react";

type PackageForm = {
  name: string;
  price: string;
  validityDays: string;
  description: string;
  tag: string;
  features: string;
  isHighlighted: boolean;
  showOnHomepage: boolean;
};

const emptyForm = (): PackageForm => ({
  name: "",
  price: "",
  validityDays: "30",
  description: "",
  tag: "",
  features: "",
  isHighlighted: false,
  showOnHomepage: false,
});

function packageToForm(pkg: CatalogPackage): PackageForm {
  return {
    name: pkg.name,
    price: String(pkg.price),
    validityDays: String(pkg.validityDays),
    description: pkg.description ?? "",
    tag: pkg.tag ?? "",
    features: (pkg.features ?? []).join("\n"),
    isHighlighted: pkg.isHighlighted,
    showOnHomepage: pkg.showOnHomepage ?? false,
  };
}

export type PackageFilter = "wash" | "solar_6" | "solar_12";

function filterPackages(list: CatalogPackage[], filter?: PackageFilter): CatalogPackage[] {
  if (!filter) return list;
  return list.filter(pkg => {
    const ents = pkg.entitlements ?? [];
    const hasSolar = ents.some(e => e.entitlementType === "solar_visit");
    const hasWash = ents.some(e => e.entitlementType === "wash_credit");
    const hasCleaning = ents.some(e => e.entitlementType === "cleaning_credit");
    if (filter === "wash") {
      return hasWash && !hasSolar && !hasCleaning;
    }
    if (!hasSolar) return false;
    const name = pkg.name.toLowerCase();
    const slug = pkg.slug.toLowerCase();
    if (filter === "solar_6") {
      return name.includes("6") || slug.includes("6-month") || slug.includes("6mo") || (pkg.validityDays >= 150 && pkg.validityDays <= 210);
    }
    return name.includes("12") || slug.includes("12-month") || slug.includes("12mo") || pkg.validityDays >= 300;
  });
}

function inclusionLabel(type: string, count: number): string {
  if (type === "wash_credit") return `${count} wash${count === 1 ? "" : "es"} included`;
  if (type === "solar_visit") return `${count} visit${count === 1 ? "" : "s"} included`;
  return `${count} included`;
}

type Props = {
  packageFilter?: PackageFilter;
};

export function PackagesTab({ packageFilter }: Props = {}) {
  const { toast } = useToast();
  const { hqEditor } = useCatalogGovernance();
  const { data: packages, isLoading } = useCatalogPackages();
  const filtered = useMemo(
    () => filterPackages(packages ?? [], packageFilter),
    [packages, packageFilter],
  );
  const { create, update } = usePackageMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogPackage | null>(null);
  const [form, setForm] = useState<PackageForm>(emptyForm());

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (pkg: CatalogPackage) => {
    setEditing(pkg);
    setForm(packageToForm(pkg));
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.price) {
      toast({ title: "Name and price required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      price: form.price,
      validityDays: parseInt(form.validityDays, 10) || 30,
      description: form.description.trim() || undefined,
      tag: form.tag.trim() || undefined,
      features: form.features.split("\n").map(s => s.trim()).filter(Boolean),
      isHighlighted: form.isHighlighted,
      showOnHomepage: form.showOnHomepage,
      status: "active",
    };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { setDialogOpen(false); toast({ title: "Package updated" }); },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { setDialogOpen(false); toast({ title: "Package created" }); },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    }
  };

  const toggleField = (pkg: CatalogPackage, field: "showOnHomepage" | "isHighlighted", value: boolean) => {
    update.mutate({ id: pkg.id, [field]: value }, {
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const isSaving = create.isPending || update.isPending;

  const showHeader = !packageFilter || packageFilter === "wash";

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-display font-bold text-lg">Wash packages</h2>
            <p className="text-sm text-muted-foreground">Prepaid multi-wash deals — 4-wash, 8-wash, 12-wash packages.{!hqEditor ? " Prices set by HQ." : ""}</p>
          </div>
          {hqEditor && (
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} className="mr-1" /> New package
            </Button>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (₹)</Label><Input className="mt-1" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><Label>Validity (days)</Label><Input type="number" className="mt-1" value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: e.target.value }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Tag (e.g. POPULAR)</Label><Input className="mt-1" value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} /></div>
            <div><Label>Features (one per line)</Label><Textarea className="mt-1" rows={4} value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isHighlighted} onCheckedChange={v => setForm(f => ({ ...f, isHighlighted: Boolean(v) }))} />
              Highlight on homepage
            </label>
            <HomepagePlanToggle
              checked={form.showOnHomepage}
              onChange={v => setForm(f => ({ ...f, showOnHomepage: v }))}
            />
            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
              {editing ? "Save changes" : "Create package"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading packages…</p>
      ) : !filtered.length ? (
        <p className="text-sm text-muted-foreground">No packages yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(pkg => (
            <Card key={pkg.id} className={pkg.isHighlighted ? "ring-2 ring-primary/30" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base">{pkg.name}</CardTitle>
                  {pkg.tag && <Badge variant="secondary" className="text-xs">{pkg.tag}</Badge>}
                </div>
                <CardDescription>{pkg.validityDays} days · ₹{Number(pkg.price).toLocaleString("en-IN")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {pkg.description && <p className="text-muted-foreground text-xs line-clamp-2">{pkg.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {(pkg.entitlements ?? []).map(e => (
                    <Badge key={e.id} variant="outline" className="text-xs">
                      {inclusionLabel(e.entitlementType, e.creditCount)}
                    </Badge>
                  ))}
                </div>
                {hqEditor && (
                  <HomepagePlanToggle
                    checked={pkg.showOnHomepage ?? false}
                    disabled={update.isPending}
                    onChange={v => toggleField(pkg, "showOnHomepage", v)}
                    className="pt-2 border-t border-border"
                  />
                )}
              </CardContent>
              {hqEditor && (
                <CardFooter className="pt-0">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => openEdit(pkg)}>
                    <Pencil size={14} className="mr-1" /> Edit
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
