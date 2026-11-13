import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminServices } from "@/features/service-catalog/api";
import { useCities } from "@/features/master-data/api";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Sparkles, Building2, MapPin, IndianRupee } from "lucide-react";

type Branch = {
  id: number;
  cityId: number;
  name: string;
};

type PricingRule = {
  id: number;
  serviceId: number;
  cityId?: number | null;
  branchId?: number | null;
  vehicleCategoryId?: number | null;
  seatCategoryId?: number | null;
  price: string;
  gstRate?: string | null;
  pricingType?: string | null;
  durationMinutes?: number | null;
  isActive: boolean;
  serviceName?: string | null;
  cityName?: string | null;
  branchName?: string | null;
};

export function PricingTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: services } = useAdminServices();
  const { data: cities } = useCities();

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [serviceId, setServiceId] = useState("");
  const [cityId, setCityId] = useState("");
  const [branchId, setBranchId] = useState("all");
  const [price, setPrice] = useState("");
  const [pricingType, setPricingType] = useState("inclusive");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch all active pricing rules
  const { data: pricingRules = [], refetch } = useQuery<PricingRule[]>({
    queryKey: ["catalog", "pricing-rules"],
    queryFn: async () => {
      const res = await fetch("/api/catalog/pricing-rules", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const save = async () => {
    if (!serviceId) {
      toast({ title: "Please select a service", variant: "destructive" });
      return;
    }
    if (!price || Number(price) <= 0) {
      toast({ title: "Please enter a valid price greater than 0", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        serviceId: parseInt(serviceId, 10),
        cityId: cityId ? parseInt(cityId, 10) : null,
        branchId: branchId && branchId !== "all" ? parseInt(branchId, 10) : null,
        price: String(price),
        pricingType,
        effectiveFrom: effectiveFrom || null,
        effectiveUntil: effectiveUntil || null,
        isActive: true,
      };

      const res = await fetch("/api/catalog/pricing-rules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save pricing rule");
      }

      toast({ title: "Pricing Rule Saved Successfully" });
      setPrice("");
      setEffectiveFrom("");
      setEffectiveUntil("");
      qc.invalidateQueries({ queryKey: ["catalog", "pricing-rules"] });
      refetch();
    } catch (e: any) {
      toast({ title: e.message || "Error saving pricing rule", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: number) => {
    try {
      const res = await fetch(`/api/catalog/pricing-rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete pricing rule");
      toast({ title: "Pricing rule deactivated" });
      qc.invalidateQueries({ queryKey: ["catalog", "pricing-rules"] });
      refetch();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const availableBranches = cityId
    ? branches.filter(b => String(b.cityId) === cityId)
    : branches;

  return (
    <div className="space-y-6">
      {/* Hierarchy Info Banner */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
        <Sparkles size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Deterministic 3-Tier Pricing Precedence</p>
          <p className="text-muted-foreground dark:text-blue-300">
            Resolution Order: <strong>Branch Price Override</strong> &gt; <strong>City Price Override</strong> &gt; <strong>Global Service Base Price</strong>. The pricing engine fails closed (rejects ₹0 or missing price) to protect revenue integrity.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee size={16} className="text-primary" />
              Configure Hierarchical Price Rule
            </CardTitle>
            <CardDescription>
              Set overrides for a specific branch or city.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div>
              <Label className="text-xs">Service *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {(services ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} (Base: ₹{s.basePrice})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">City Scope</Label>
                <Select value={cityId} onValueChange={(val) => { setCityId(val); setBranchId("all"); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All Cities (Global)" /></SelectTrigger>
                  <SelectContent>
                    {(cities ?? []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Branch Scope</Label>
                <Select value={branchId} onValueChange={setBranchId} disabled={!cityId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="All Branches in City" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches in City</SelectItem>
                    {availableBranches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Override Price (₹) *</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. 1199"
                />
              </div>

              <div>
                <Label className="text-xs">Pricing Tax Model</Label>
                <Select value={pricingType} onValueChange={setPricingType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inclusive">GST Inclusive</SelectItem>
                    <SelectItem value="exclusive">GST Exclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Effective From</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Effective Until</Label>
                <Input
                  type="date"
                  value={effectiveUntil}
                  onChange={e => setEffectiveUntil(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <Button onClick={save} disabled={saving || !serviceId || !price} className="w-full mt-2">
              Save Pricing Rule
            </Button>
          </CardContent>
        </Card>

        {/* Active Rules List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Active Pricing Rules</span>
              <Badge variant="outline" className="text-xs font-mono font-normal">
                {pricingRules.length} rules
              </Badge>
            </CardTitle>
            <CardDescription>
              Rules currently evaluated by the dynamic pricing engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 max-h-[420px] overflow-y-auto">
            {pricingRules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors">
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    {rule.serviceName || `Service #${rule.serviceId}`}
                    {rule.branchName ? (
                      <Badge className="bg-purple-600 text-[10px] py-0">Branch: {rule.branchName}</Badge>
                    ) : rule.cityName ? (
                      <Badge className="bg-blue-600 text-[10px] py-0">City: {rule.cityName}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0">Global</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {rule.pricingType === "exclusive" ? "+ GST Extra" : "GST Inclusive"}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-foreground">
                    ₹{Number(rule.price).toLocaleString("en-IN")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteRule(rule.id)}
                    title="Deactivate rule"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
            {!pricingRules.length && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No custom pricing overrides configured. Global service prices apply.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
