import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListServices } from "@workspace/api-client-react";
import { useCatalogMutations, useCatalogPackages, useSolarSlabs, type SolarSlab } from "@/features/service-catalog/api";
import { useToast } from "@/hooks/use-toast";

const TERM_LABELS: Record<string, string> = {
  one_time: "One time",
  amc_6: "6 month AMC",
  amc_12: "12 month AMC",
};

const EMPTY_FORM = {
  term: "one_time",
  minPanels: "",
  maxPanels: "",
  pricePerPanel: "",
  minimumBilling: "",
  requiresSiteVisit: false,
  packageId: "",
};

export function SolarSlabsTab() {
  const { toast } = useToast();
  const { data: services } = useListServices({});
  const solarServices = (services ?? []).filter(s =>
    s.category === "solar_cleaning" || (s as { pricingModel?: string }).pricingModel === "solar_slab",
  );
  const [serviceId, setServiceId] = useState("");
  const { data: slabs, refetch } = useSolarSlabs(serviceId ? parseInt(serviceId) : undefined, { includeInactive: true });
  const { data: packages } = useCatalogPackages();
  const solarPackages = useMemo(
    () => (packages ?? []).filter(p =>
      (p.entitlements ?? []).some(e => e.entitlementType === "solar_visit") || p.solarTerm,
    ),
    [packages],
  );
  const mutations = useCatalogMutations("solar-slabs");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (!serviceId && solarServices[0]?.id) setServiceId(String(solarServices[0].id));
  }, [solarServices, serviceId]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (slab: SolarSlab) => {
    setEditingId(slab.id);
    setForm({
      term: slab.term ?? "one_time",
      minPanels: String(slab.minPanels ?? ""),
      maxPanels: slab.maxPanels != null ? String(slab.maxPanels) : "",
      pricePerPanel: slab.pricePerPanel ?? "",
      minimumBilling: slab.minimumBilling ?? "",
      requiresSiteVisit: Boolean(slab.requiresSiteVisit),
      packageId: slab.packageId != null ? String(slab.packageId) : "",
    });
  };

  const payload = () => ({
    serviceId: parseInt(serviceId),
    term: form.term,
    minPanels: parseInt(form.minPanels),
    maxPanels: form.maxPanels ? parseInt(form.maxPanels) : null,
    pricePerPanel: form.requiresSiteVisit || !form.pricePerPanel ? null : form.pricePerPanel,
    minimumBilling: form.minimumBilling || "0",
    requiresSiteVisit: form.requiresSiteVisit,
    packageId: form.packageId ? parseInt(form.packageId) : null,
    isActive: true,
  });

  const save = () => {
    if (!serviceId || !form.minPanels) {
      toast({ title: "Service and min panels are required", variant: "destructive" });
      return;
    }
    if (!form.requiresSiteVisit && !form.pricePerPanel) {
      toast({ title: "₹/panel is required unless site visit is enabled", variant: "destructive" });
      return;
    }
    const body = payload();
    if (editingId) {
      mutations.update.mutate({ id: editingId, ...body }, {
        onSuccess: () => { toast({ title: "Rate card row updated" }); resetForm(); refetch(); },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    } else {
      mutations.create.mutate(body, {
        onSuccess: () => { toast({ title: "Rate card row saved" }); resetForm(); refetch(); },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      });
    }
  };

  const deactivate = (id: number) => {
    mutations.remove.mutate(id, {
      onSuccess: () => { toast({ title: "Slab deactivated" }); refetch(); },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const activeSlabs = (slabs ?? []).filter(s => s.isActive !== false);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure panel bands, ₹/panel, minimum billing, and site-visit rows. Booking quotes read only from this table — nothing is hardcoded in the app.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Edit rate card row" : "Add rate card row"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Service</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select solar service" /></SelectTrigger>
                <SelectContent>
                  {solarServices.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Term</Label>
              <Select value={form.term} onValueChange={v => setForm(f => ({ ...f, term: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TERM_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.term !== "one_time" && (
              <div>
                <Label>Link package (optional)</Label>
                <Select
                  value={form.packageId || "none"}
                  onValueChange={v => setForm(f => ({ ...f, packageId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any matching term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any package with this term</SelectItem>
                    {solarPackages.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Min panels</Label>
                <Input value={form.minPanels} onChange={e => setForm(f => ({ ...f, minPanels: e.target.value }))} className="mt-1" inputMode="numeric" />
              </div>
              <div>
                <Label>Max panels</Label>
                <Input value={form.maxPanels} onChange={e => setForm(f => ({ ...f, maxPanels: e.target.value }))} className="mt-1" placeholder="Open-ended" inputMode="numeric" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded border px-3 py-2">
              <div>
                <Label>Requires site visit</Label>
                <p className="text-[11px] text-muted-foreground">Callback + custom quote (e.g. large sites)</p>
              </div>
              <Switch
                checked={form.requiresSiteVisit}
                onCheckedChange={v => setForm(f => ({ ...f, requiresSiteVisit: v, pricePerPanel: v ? "" : f.pricePerPanel }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>₹/panel</Label>
                <Input
                  value={form.pricePerPanel}
                  onChange={e => setForm(f => ({ ...f, pricePerPanel: e.target.value }))}
                  className="mt-1"
                  disabled={form.requiresSiteVisit}
                  placeholder={form.requiresSiteVisit ? "N/A" : ""}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label>Min billing (₹)</Label>
                <Input
                  value={form.minimumBilling}
                  onChange={e => setForm(f => ({ ...f, minimumBilling: e.target.value }))}
                  className="mt-1"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={!serviceId} className="flex-1">
                {editingId ? "Update" : "Save"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Configured rate card</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {activeSlabs.length === 0 && (
              <p className="text-sm text-muted-foreground">No active slabs for this service.</p>
            )}
            {activeSlabs.map(slab => (
              <div key={slab.id} className="p-3 border rounded space-y-2 text-sm">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="secondary">{TERM_LABELS[slab.term ?? "one_time"] ?? slab.term}</Badge>
                  <span className="font-medium">
                    {slab.minPanels}–{slab.maxPanels ?? "∞"} panels
                  </span>
                  {slab.requiresSiteVisit ? (
                    <Badge variant="outline">Site visit</Badge>
                  ) : (
                    <span>₹{slab.pricePerPanel}/panel</span>
                  )}
                  <span className="text-muted-foreground">min ₹{slab.minimumBilling}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(slab)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => deactivate(slab.id)}>Deactivate</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
