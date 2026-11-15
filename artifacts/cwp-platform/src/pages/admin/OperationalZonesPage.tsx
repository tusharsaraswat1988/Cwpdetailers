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
  MapPin,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Shield,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Globe,
  Radio,
} from "lucide-react";

type OperationalZone = {
  id: number;
  cityId: number;
  branchId: number | null;
  name: string;
  code: string;
  description: string | null;
  centerLatitude: string | null;
  centerLongitude: string | null;
  radiusMeters: number | null;
  status: "active" | "inactive" | "maintenance";
  createdAt: string;
};

type ZoneCoverageRule = {
  id: number;
  zoneId: number;
  branchId: number | null;
  coverageType: "society" | "locality" | "pincode" | "property_type" | "all";
  societyId: number | null;
  localityId: number | null;
  pincode: string | null;
  propertyType: string | null;
  serviceId: number | null;
  status: "serviceable" | "not_serviceable" | "waitlist" | "coming_soon";
  rejectionReason: string | null;
  priority: number;
  createdAt: string;
};

type City = { id: number; name: string };
type Branch = { id: number; name: string; cityId?: number };

export default function OperationalZonesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Zone Modal
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<OperationalZone | null>(null);
  const [zoneForm, setZoneForm] = useState({
    cityId: "",
    branchId: "",
    name: "",
    code: "",
    description: "",
    centerLatitude: "",
    centerLongitude: "",
    radiusMeters: "5000",
    status: "active",
  });

  // Coverage Rules Modal
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [activeZoneForRules, setActiveZoneForRules] = useState<OperationalZone | null>(null);
  const [ruleForm, setRuleForm] = useState({
    coverageType: "society",
    societyId: "",
    localityId: "",
    pincode: "",
    propertyType: "ALL",
    status: "serviceable",
    rejectionReason: "",
    priority: "100",
  });

  // Fetch Cities & Branches
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

  // Fetch Operational Zones
  const { data: zones = [], isLoading: zonesLoading } = useQuery<OperationalZone[]>({
    queryKey: ["operational-zones", selectedCityId, selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCityId !== "all") params.append("cityId", selectedCityId);
      if (selectedBranchId !== "all") params.append("branchId", selectedBranchId);
      const res = await fetch(`/api/zones?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Coverage Rules for Selected Zone
  const { data: coverageRules = [], isLoading: rulesLoading, refetch: refetchRules } = useQuery<ZoneCoverageRule[]>({
    queryKey: ["zone-coverage-rules", activeZoneForRules?.id],
    enabled: Boolean(activeZoneForRules),
    queryFn: async () => {
      if (!activeZoneForRules) return [];
      const res = await fetch(`/api/zones/${activeZoneForRules.id}/coverage`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Save Zone Mutation
  const saveZoneMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cityId: parseInt(zoneForm.cityId, 10),
        branchId: zoneForm.branchId ? parseInt(zoneForm.branchId, 10) : undefined,
        name: zoneForm.name.trim(),
        code: zoneForm.code.trim().toUpperCase(),
        description: zoneForm.description.trim() || undefined,
        centerLatitude: zoneForm.centerLatitude.trim() || undefined,
        centerLongitude: zoneForm.centerLongitude.trim() || undefined,
        radiusMeters: zoneForm.radiusMeters ? parseInt(zoneForm.radiusMeters, 10) : undefined,
        status: zoneForm.status,
      };

      if (editingZone) {
        const res = await fetch(`/api/zones/${editingZone.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update operational zone");
        return res.json();
      } else {
        const res = await fetch("/api/zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create operational zone");
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: editingZone ? "Zone updated" : "Zone created successfully" });
      setZoneModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["operational-zones"] });
    },
    onError: (err: any) => {
      toast({ title: "Error saving zone", description: err.message, variant: "destructive" });
    },
  });

  // Add Coverage Rule Mutation
  const addRuleMutation = useMutation({
    mutationFn: async () => {
      if (!activeZoneForRules) return;
      const payload = {
        branchId: activeZoneForRules.branchId,
        coverageType: ruleForm.coverageType,
        societyId: ruleForm.societyId ? parseInt(ruleForm.societyId, 10) : undefined,
        localityId: ruleForm.localityId ? parseInt(ruleForm.localityId, 10) : undefined,
        pincode: ruleForm.pincode.trim() || undefined,
        propertyType: ruleForm.propertyType === "ALL" ? undefined : ruleForm.propertyType,
        status: ruleForm.status,
        rejectionReason: ruleForm.rejectionReason.trim() || undefined,
        priority: parseInt(ruleForm.priority, 10) || 100,
      };

      const res = await fetch(`/api/zones/${activeZoneForRules.id}/coverage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add coverage rule");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Coverage rule added" });
      setRuleForm({
        coverageType: "society",
        societyId: "",
        localityId: "",
        pincode: "",
        propertyType: "ALL",
        status: "serviceable",
        rejectionReason: "",
        priority: "100",
      });
      refetchRules();
    },
    onError: (err: any) => {
      toast({ title: "Error adding rule", description: err.message, variant: "destructive" });
    },
  });

  // Delete Coverage Rule Mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      const res = await fetch(`/api/zones/coverage/${ruleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete coverage rule");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rule removed" });
      refetchRules();
    },
    onError: (err: any) => {
      toast({ title: "Error removing rule", description: err.message, variant: "destructive" });
    },
  });

  const openCreateZone = () => {
    setEditingZone(null);
    setZoneForm({
      cityId: cities[0] ? String(cities[0].id) : "",
      branchId: branches[0] ? String(branches[0].id) : "",
      name: "",
      code: "",
      description: "",
      centerLatitude: "",
      centerLongitude: "",
      radiusMeters: "5000",
      status: "active",
    });
    setZoneModalOpen(true);
  };

  const openEditZone = (z: OperationalZone) => {
    setEditingZone(z);
    setZoneForm({
      cityId: String(z.cityId),
      branchId: z.branchId ? String(z.branchId) : "",
      name: z.name,
      code: z.code,
      description: z.description || "",
      centerLatitude: z.centerLatitude || "",
      centerLongitude: z.centerLongitude || "",
      radiusMeters: z.radiusMeters ? String(z.radiusMeters) : "5000",
      status: z.status,
    });
    setZoneModalOpen(true);
  };

  const openManageRules = (z: OperationalZone) => {
    setActiveZoneForRules(z);
    setRulesModalOpen(true);
  };

  const filteredZones = zones.filter(z => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return z.name.toLowerCase().includes(q) || z.code.toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Layers className="h-6 w-6 text-primary" />
              Operational Zones & Coverage
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Decouple geographic locations from branches. Define operational zones, serviceability boundaries, and coverage rules.
            </p>
          </div>
          <Button onClick={openCreateZone} className="shadow-xs" data-testid="btn-create-zone">
            <Plus className="h-4 w-4 mr-2" />
            New Operational Zone
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search zones by name or code…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="w-full sm:w-48">
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

          <div className="w-full sm:w-52">
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
        </div>

        {/* Zones List */}
        {zonesLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading operational zones…</div>
        ) : filteredZones.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center bg-card">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-semibold">No operational zones configured</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Create an operational zone for your city or branch to begin mapping coverage boundaries and societies.
            </p>
            <Button onClick={openCreateZone} variant="outline" className="mt-4" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Zone
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredZones.map(z => {
              const cityName = cities.find(c => c.id === z.cityId)?.name || `City #${z.cityId}`;
              const branchName = branches.find(b => b.id === z.branchId)?.name || "Unassigned Branch";

              return (
                <div
                  key={z.id}
                  className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] uppercase font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {z.code}
                        </span>
                        <h3 className="text-base font-bold mt-1 text-foreground leading-snug">{z.name}</h3>
                      </div>
                      <Badge
                        variant={z.status === "active" ? "default" : "secondary"}
                        className={z.status === "active" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      >
                        {z.status}
                      </Badge>
                    </div>

                    {z.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{z.description}</p>
                    )}

                    <div className="space-y-1.5 pt-2 border-t text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          City
                        </span>
                        <span className="font-medium text-foreground">{cityName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          Operating Branch
                        </span>
                        <span className="font-medium text-foreground">{branchName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                          Service Radius
                        </span>
                        <span className="font-medium text-foreground">
                          {z.radiusMeters ? `${(z.radiusMeters / 1000).toFixed(1)} km` : "Custom boundary"}
                        </span>
                      </div>
                      {z.centerLatitude && z.centerLongitude && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            Center GPS
                          </span>
                          <span className="font-mono text-[11px] text-foreground">
                            {Number(z.centerLatitude).toFixed(4)}, {Number(z.centerLongitude).toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 mt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => openManageRules(z)}
                      data-testid={`btn-zone-coverage-${z.id}`}
                    >
                      <Shield className="h-3.5 w-3.5 mr-1 text-primary" />
                      Coverage Rules
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => openEditZone(z)}
                      data-testid={`btn-edit-zone-${z.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Zone Create / Edit Modal */}
        <Dialog open={zoneModalOpen} onOpenChange={setZoneModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingZone ? "Edit Operational Zone" : "Create Operational Zone"}</DialogTitle>
              <DialogDescription>
                Define operational boundaries and map the zone to its primary serving branch.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">City *</Label>
                  <Select
                    value={zoneForm.cityId}
                    onValueChange={v => setZoneForm(p => ({ ...p, cityId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select city" />
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
                  <Label className="text-xs">Serving Branch</Label>
                  <Select
                    value={zoneForm.branchId}
                    onValueChange={v => setZoneForm(p => ({ ...p, branchId: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Zone Name *</Label>
                <Input
                  value={zoneForm.name}
                  onChange={e => setZoneForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Noida Expressway Zone, Sigra Zone"
                  className="h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Zone Code *</Label>
                  <Input
                    value={zoneForm.code}
                    onChange={e => setZoneForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="NOIDA-EXP-01"
                    className="h-10 font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={zoneForm.status}
                    onValueChange={v => setZoneForm(p => ({ ...p, status: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Center Lat</Label>
                  <Input
                    value={zoneForm.centerLatitude}
                    onChange={e => setZoneForm(p => ({ ...p, centerLatitude: e.target.value }))}
                    placeholder="28.5355"
                    className="h-10 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Center Lng</Label>
                  <Input
                    value={zoneForm.centerLongitude}
                    onChange={e => setZoneForm(p => ({ ...p, centerLongitude: e.target.value }))}
                    placeholder="77.3910"
                    className="h-10 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Radius (Meters)</Label>
                  <Input
                    value={zoneForm.radiusMeters}
                    onChange={e => setZoneForm(p => ({ ...p, radiusMeters: e.target.value }))}
                    placeholder="5000"
                    className="h-10 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Description / Landmarks</Label>
                <Input
                  value={zoneForm.description}
                  onChange={e => setZoneForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Covers Sectors 128 to 137, Jaypee Wish Town and surroundings"
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setZoneModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveZoneMutation.mutate()}
                disabled={!zoneForm.name || !zoneForm.code || !zoneForm.cityId || saveZoneMutation.isPending}
              >
                {saveZoneMutation.isPending ? "Saving…" : editingZone ? "Update Zone" : "Create Zone"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Zone Coverage Rules Drawer/Dialog */}
        <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Coverage Rules — {activeZoneForRules?.name}
              </DialogTitle>
              <DialogDescription>
                Explicit rules defining which societies, localities, pincodes, or property types are serviceable within this zone.
              </DialogDescription>
            </DialogHeader>

            {/* Add Rule Sub-Form */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add New Coverage Rule</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Rule Type</Label>
                  <Select
                    value={ruleForm.coverageType}
                    onValueChange={v => setRuleForm(p => ({ ...p, coverageType: v }))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="society">Society</SelectItem>
                      <SelectItem value="locality">Locality / Sector</SelectItem>
                      <SelectItem value="pincode">Pincode</SelectItem>
                      <SelectItem value="property_type">Property Type</SelectItem>
                      <SelectItem value="all">All Zone Areas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Property Type</Label>
                  <Select
                    value={ruleForm.propertyType}
                    onValueChange={v => setRuleForm(p => ({ ...p, propertyType: v }))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="GATED_SOCIETY">Gated Society</SelectItem>
                      <SelectItem value="INDIVIDUAL_HOME">Individual Home</SelectItem>
                      <SelectItem value="APARTMENT">Apartment</SelectItem>
                      <SelectItem value="COMMERCIAL_PROPERTY">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Status</Label>
                  <Select
                    value={ruleForm.status}
                    onValueChange={v => setRuleForm(p => ({ ...p, status: v }))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serviceable">Serviceable</SelectItem>
                      <SelectItem value="waitlist">Waitlist</SelectItem>
                      <SelectItem value="coming_soon">Coming Soon</SelectItem>
                      <SelectItem value="not_serviceable">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Priority</Label>
                  <Input
                    value={ruleForm.priority}
                    onChange={e => setRuleForm(p => ({ ...p, priority: e.target.value }))}
                    className="h-9 text-xs font-mono"
                    placeholder="100"
                  />
                </div>
              </div>

              {ruleForm.coverageType === "society" && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Society ID</Label>
                  <Input
                    value={ruleForm.societyId}
                    onChange={e => setRuleForm(p => ({ ...p, societyId: e.target.value }))}
                    placeholder="Enter residential society ID"
                    className="h-9 text-xs"
                  />
                </div>
              )}

              {ruleForm.coverageType === "locality" && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Locality ID</Label>
                  <Input
                    value={ruleForm.localityId}
                    onChange={e => setRuleForm(p => ({ ...p, localityId: e.target.value }))}
                    placeholder="Enter locality ID"
                    className="h-9 text-xs"
                  />
                </div>
              )}

              {ruleForm.coverageType === "pincode" && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Pincode</Label>
                  <Input
                    value={ruleForm.pincode}
                    onChange={e => setRuleForm(p => ({ ...p, pincode: e.target.value }))}
                    placeholder="e.g. 201301"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              )}

              {ruleForm.status !== "serviceable" && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Rejection / Waitlist Notice</Label>
                  <Input
                    value={ruleForm.rejectionReason}
                    onChange={e => setRuleForm(p => ({ ...p, rejectionReason: e.target.value }))}
                    placeholder="e.g. Expanding in Q2; Join priority waitlist"
                    className="h-9 text-xs"
                  />
                </div>
              )}

              <Button
                size="sm"
                className="w-full h-9 text-xs"
                onClick={() => addRuleMutation.mutate()}
                disabled={addRuleMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {addRuleMutation.isPending ? "Adding…" : "Add Coverage Rule"}
              </Button>
            </div>

            {/* Existing Rules Table */}
            <div className="space-y-2 mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configured Coverage Rules</h4>
              {rulesLoading ? (
                <div className="text-center py-6 text-xs text-muted-foreground">Loading rules…</div>
              ) : coverageRules.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border rounded-xl">
                  No explicit rules. All locations without rules default to fail-closed protection.
                </div>
              ) : (
                <div className="border rounded-xl divide-y">
                  {coverageRules.map(r => (
                    <div key={r.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold capitalize text-foreground">{r.coverageType}</span>
                          <Badge
                            variant={r.status === "serviceable" ? "default" : "secondary"}
                            className={r.status === "serviceable" ? "bg-emerald-600 text-[10px] h-5" : "text-[10px] h-5"}
                          >
                            {r.status}
                          </Badge>
                          {r.propertyType && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {r.propertyType}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-mono">P:{r.priority}</span>
                        </div>
                        {r.rejectionReason && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">{r.rejectionReason}</p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteRuleMutation.mutate(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setRulesModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
