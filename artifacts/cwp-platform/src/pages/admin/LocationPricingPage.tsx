import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Percent,
  History,
  Building2,
  Home,
  Building,
  CheckCircle2,
  Trash2,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpDown,
} from "lucide-react";

type LocationPricingRule = {
  id: number;
  serviceId: number;
  packageId: number | null;
  cityId: number;
  branchId: number | null;
  zoneId: number | null;
  societyId: number | null;
  locationType: "GATED_SOCIETY" | "APARTMENT" | "INDIVIDUAL_HOME" | "COMMERCIAL_PROPERTY" | "OTHER" | "ALL";
  vehicleCategoryId: number | null;
  basePrice: string;
  gstRate: string;
  pricingType: "FLAT" | "PERCENTAGE_DISCOUNT" | "SURCHARGE";
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: "active" | "inactive" | "draft";
  priority: number;
  notes: string | null;
  createdAt: string;
};

type PricingAuditLog = {
  id: number;
  ruleId: number;
  action: string;
  previousValues: any;
  newValues: any;
  changedBy: number | null;
  createdAt: string;
};

type City = { id: number; name: string };
type Branch = { id: number; name: string };
type Zone = { id: number; name: string; code: string };
type Service = { id: number; name: string };

export default function LocationPricingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedLocationType, setSelectedLocationType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Modal
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LocationPricingRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    cityId: "",
    branchId: "",
    zoneId: "",
    societyId: "",
    serviceId: "",
    packageId: "",
    locationType: "GATED_SOCIETY",
    basePrice: "1200",
    gstRate: "18.00",
    pricingType: "FLAT",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveUntil: "",
    status: "active",
    priority: "50",
    notes: "",
  });

  // Audit Logs Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedRuleForAudit, setSelectedRuleForAudit] = useState<LocationPricingRule | null>(null);

  // Fetch Cities, Branches, Services
  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ["cities-list"],
    queryFn: async () => {
      const res = await fetch("/api/cities", { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.items || [];
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.items || [];
    },
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ["operational-zones-simple"],
    queryFn: async () => {
      const res = await fetch("/api/zones", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services-list"],
    queryFn: async () => {
      const res = await fetch("/api/catalog/services", { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.items || [];
    },
  });

  // Fetch Pricing Rules
  const { data: pricingRules = [], isLoading: rulesLoading } = useQuery<LocationPricingRule[]>({
    queryKey: ["location-pricing-rules", selectedCityId, selectedBranchId, selectedLocationType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCityId !== "all") params.append("cityId", selectedCityId);
      if (selectedBranchId !== "all") params.append("branchId", selectedBranchId);
      if (selectedLocationType !== "all") params.append("locationType", selectedLocationType);
      const res = await fetch(`/api/location-pricing?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Audit Logs for Rule
  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<PricingAuditLog[]>({
    queryKey: ["pricing-rule-audit", selectedRuleForAudit?.id],
    enabled: Boolean(selectedRuleForAudit),
    queryFn: async () => {
      if (!selectedRuleForAudit) return [];
      const res = await fetch(`/api/location-pricing/${selectedRuleForAudit.id}/audit`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Save Pricing Rule Mutation
  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cityId: parseInt(ruleForm.cityId, 10),
        branchId: ruleForm.branchId ? parseInt(ruleForm.branchId, 10) : undefined,
        zoneId: ruleForm.zoneId ? parseInt(ruleForm.zoneId, 10) : undefined,
        societyId: ruleForm.societyId ? parseInt(ruleForm.societyId, 10) : undefined,
        serviceId: parseInt(ruleForm.serviceId, 10),
        packageId: ruleForm.packageId ? parseInt(ruleForm.packageId, 10) : undefined,
        locationType: ruleForm.locationType,
        basePrice: ruleForm.basePrice,
        gstRate: ruleForm.gstRate,
        pricingType: ruleForm.pricingType,
        effectiveFrom: ruleForm.effectiveFrom,
        effectiveUntil: ruleForm.effectiveUntil || undefined,
        status: ruleForm.status,
        priority: parseInt(ruleForm.priority, 10) || 50,
        notes: ruleForm.notes.trim() || undefined,
      };

      if (editingRule) {
        const res = await fetch(`/api/location-pricing/${editingRule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update pricing rule");
        return res.json();
      } else {
        const res = await fetch("/api/location-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create pricing rule");
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: editingRule ? "Pricing rule updated" : "Pricing rule created" });
      setPricingModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["location-pricing-rules"] });
    },
    onError: (err: any) => {
      toast({ title: "Error saving pricing rule", description: err.message, variant: "destructive" });
    },
  });

  // Delete Pricing Rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/location-pricing/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to deactivate pricing rule");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pricing rule deactivated" });
      queryClient.invalidateQueries({ queryKey: ["location-pricing-rules"] });
    },
    onError: (err: any) => {
      toast({ title: "Error deleting rule", description: err.message, variant: "destructive" });
    },
  });

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({
      cityId: cities[0] ? String(cities[0].id) : "",
      branchId: branches[0] ? String(branches[0].id) : "",
      zoneId: "",
      societyId: "",
      serviceId: services[0] ? String(services[0].id) : "",
      packageId: "",
      locationType: "GATED_SOCIETY",
      basePrice: "1200",
      gstRate: "18.00",
      pricingType: "FLAT",
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveUntil: "",
      status: "active",
      priority: "50",
      notes: "",
    });
    setPricingModalOpen(true);
  };

  const openEditRule = (r: LocationPricingRule) => {
    setEditingRule(r);
    setRuleForm({
      cityId: String(r.cityId),
      branchId: r.branchId ? String(r.branchId) : "",
      zoneId: r.zoneId ? String(r.zoneId) : "",
      societyId: r.societyId ? String(r.societyId) : "",
      serviceId: String(r.serviceId),
      packageId: r.packageId ? String(r.packageId) : "",
      locationType: r.locationType,
      basePrice: String(r.basePrice),
      gstRate: String(r.gstRate || "18.00"),
      pricingType: r.pricingType,
      effectiveFrom: r.effectiveFrom ? r.effectiveFrom.slice(0, 10) : "",
      effectiveUntil: r.effectiveUntil ? r.effectiveUntil.slice(0, 10) : "",
      status: r.status,
      priority: String(r.priority),
      notes: r.notes || "",
    });
    setPricingModalOpen(true);
  };

  const openAuditLogs = (r: LocationPricingRule) => {
    setSelectedRuleForAudit(r);
    setAuditModalOpen(true);
  };

  const filteredRules = pricingRules.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const serviceName = services.find(s => s.id === r.serviceId)?.name || "";
    return serviceName.toLowerCase().includes(q) || r.locationType.toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Percent className="h-6 w-6 text-primary" />
              Location-Based Differential Pricing
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure tiered pricing based on customer property type (Society vs Individual House), zones, and branches with deterministic priority resolution.
            </p>
          </div>
          <Button onClick={openCreateRule} className="shadow-xs" data-testid="btn-create-pricing-rule">
            <Plus className="h-4 w-4 mr-2" />
            New Pricing Rule
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by service or property type…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="w-full sm:w-44">
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-48">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-48">
            <Select value={selectedLocationType} onValueChange={setSelectedLocationType}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Property Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Property Types</SelectItem>
                <SelectItem value="GATED_SOCIETY">Gated Society</SelectItem>
                <SelectItem value="INDIVIDUAL_HOME">Individual Home</SelectItem>
                <SelectItem value="APARTMENT">Apartment</SelectItem>
                <SelectItem value="COMMERCIAL_PROPERTY">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pricing Rules Table */}
        {rulesLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading differential pricing rules…</div>
        ) : filteredRules.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center bg-card">
            <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-semibold">No differential pricing rules configured</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Create rules to distinguish society customer pricing (e.g. ₹1,200/mo) from individual house pricing (e.g. ₹1,500/mo).
            </p>
            <Button onClick={openCreateRule} variant="outline" className="mt-4" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Pricing Rule
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="p-3 pl-4">Service</th>
                    <th className="p-3">Scope & Location Type</th>
                    <th className="p-3">Base Price (₹)</th>
                    <th className="p-3">GST Rate</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Effective Window</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRules.map(r => {
                    const serviceName = services.find(s => s.id === r.serviceId)?.name || `Service #${r.serviceId}`;
                    const cityName = cities.find(c => c.id === r.cityId)?.name || `City #${r.cityId}`;
                    const branchName = branches.find(b => b.id === r.branchId)?.name;
                    const zoneName = zones.find(z => z.id === r.zoneId)?.name;

                    return (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 pl-4 font-semibold text-foreground">
                          {serviceName}
                          {r.packageId && <span className="block text-[10px] text-muted-foreground">Pkg #{r.packageId}</span>}
                        </td>
                        <td className="p-3 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">
                              {r.locationType === "GATED_SOCIETY" ? "Gated Society" : r.locationType === "INDIVIDUAL_HOME" ? "Individual House" : r.locationType}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {cityName}
                            {branchName ? ` • ${branchName}` : ""}
                            {zoneName ? ` • ${zoneName}` : ""}
                            {r.societyId ? ` • Society #${r.societyId}` : ""}
                          </p>
                        </td>
                        <td className="p-3 font-mono font-bold text-sm text-foreground">
                          ₹{Number(r.basePrice).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {r.gstRate}%
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary">
                            {r.priority}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground text-[11px]">
                          <div>From: {r.effectiveFrom ? r.effectiveFrom.slice(0, 10) : "Immediate"}</div>
                          <div>To: {r.effectiveUntil ? r.effectiveUntil.slice(0, 10) : "Open-ended"}</div>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={r.status === "active" ? "default" : "secondary"}
                            className={r.status === "active" ? "bg-emerald-600 hover:bg-emerald-700 text-[10px] h-5" : "text-[10px] h-5"}
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => openAuditLogs(r)}
                              title="Audit Trail"
                            >
                              <History className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                              Audit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => openEditRule(r)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteRuleMutation.mutate(r.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create / Edit Rule Dialog */}
        <Dialog open={pricingModalOpen} onOpenChange={setPricingModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Location Pricing Rule" : "Create Location Pricing Rule"}</DialogTitle>
              <DialogDescription>
                Define base prices and GST rates for specific location types, societies, or operational zones.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Service *</Label>
                  <Select
                    value={ruleForm.serviceId}
                    onValueChange={v => setRuleForm(p => ({ ...p, serviceId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Location Type *</Label>
                  <Select
                    value={ruleForm.locationType}
                    onValueChange={v => setRuleForm(p => ({ ...p, locationType: v as any }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GATED_SOCIETY">Gated Society</SelectItem>
                      <SelectItem value="INDIVIDUAL_HOME">Individual House</SelectItem>
                      <SelectItem value="APARTMENT">Apartment</SelectItem>
                      <SelectItem value="COMMERCIAL_PROPERTY">Commercial</SelectItem>
                      <SelectItem value="ALL">All Types</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">City *</Label>
                  <Select
                    value={ruleForm.cityId}
                    onValueChange={v => setRuleForm(p => ({ ...p, cityId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="City" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Branch (optional)</Label>
                  <Select
                    value={ruleForm.branchId}
                    onValueChange={v => setRuleForm(p => ({ ...p, branchId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Branches</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Zone (optional)</Label>
                  <Select
                    value={ruleForm.zoneId}
                    onValueChange={v => setRuleForm(p => ({ ...p, zoneId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All Zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Zones</SelectItem>
                      {zones.map(z => (
                        <SelectItem key={z.id} value={String(z.id)}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Base Price (₹) *</Label>
                  <Input
                    value={ruleForm.basePrice}
                    onChange={e => setRuleForm(p => ({ ...p, basePrice: e.target.value }))}
                    className="h-10 font-mono text-sm"
                    placeholder="1200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">GST Rate (%)</Label>
                  <Input
                    value={ruleForm.gstRate}
                    onChange={e => setRuleForm(p => ({ ...p, gstRate: e.target.value }))}
                    className="h-10 font-mono text-sm"
                    placeholder="18.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Priority (1-100)</Label>
                  <Input
                    value={ruleForm.priority}
                    onChange={e => setRuleForm(p => ({ ...p, priority: e.target.value }))}
                    className="h-10 font-mono text-sm"
                    placeholder="50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Effective From</Label>
                  <Input
                    type="date"
                    value={ruleForm.effectiveFrom}
                    onChange={e => setRuleForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Effective Until (optional)</Label>
                  <Input
                    type="date"
                    value={ruleForm.effectiveUntil}
                    onChange={e => setRuleForm(p => ({ ...p, effectiveUntil: e.target.value }))}
                    className="h-10 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes / Commercial Justification</Label>
                <Input
                  value={ruleForm.notes}
                  onChange={e => setRuleForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Noida High-Rise Society Cluster Discount vs Independent House Doorstep"
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPricingModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveRuleMutation.mutate()}
                disabled={!ruleForm.serviceId || !ruleForm.cityId || !ruleForm.basePrice || saveRuleMutation.isPending}
              >
                {saveRuleMutation.isPending ? "Saving…" : editingRule ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Audit Logs Dialog */}
        <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
          <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Pricing Audit History
              </DialogTitle>
              <DialogDescription>
                Immutable record of all price adjustments, effective date revisions, and author timestamps.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {auditLoading ? (
                <div className="text-center py-6 text-xs text-muted-foreground">Loading audit trail…</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border rounded-xl">
                  No previous audit records recorded for this rule.
                </div>
              ) : (
                <div className="border rounded-xl divide-y">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-foreground">
                          {log.action}
                        </span>
                        <span className="font-mono text-[10px]">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] grid grid-cols-2 gap-2 mt-1">
                        {log.previousValues && (
                          <div className="rounded bg-muted/40 p-2">
                            <span className="text-[10px] text-muted-foreground font-semibold block">Previous Price</span>
                            <span className="font-mono">₹{log.previousValues.basePrice}</span>
                          </div>
                        )}
                        {log.newValues && (
                          <div className="rounded bg-primary/5 p-2">
                            <span className="text-[10px] text-primary font-semibold block">New Price</span>
                            <span className="font-mono text-primary font-bold">₹{log.newValues.basePrice}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAuditModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
