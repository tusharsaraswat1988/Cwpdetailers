import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  MapPin,
  Users,
  Building2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  CheckCircle,
  XCircle,
  Activity,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { useMasterList, type City } from "@/features/master-data/api";

type BranchItem = {
  id: number;
  name: string;
  code: string | null;
  city: string;
  cityId: number | null;
  cityName: string | null;
  address: string | null;
  phone: string | null;
  managerName: string | null;
  companyId: number | null;
  franchiseeId: number | null;
  franchiseeName: string | null;
  legalEntityId: number | null;
  legalEntityName: string | null;
  isCompanyOperated: boolean;
  status: string;
  serviceAvailability: string[] | null;
  operationalNotes: string | null;
  isActive: boolean;
  createdAt: string;
  customerCount: number;
  staffCount: number;
  activeSubscriptionsCount: number;
};

type BranchReadinessReport = {
  branchId: number;
  branchName: string;
  isReady: boolean;
  score: number;
  status: string;
  isCompanyOperated: boolean;
  checklist: Array<{
    key: string;
    label: string;
    passed: boolean;
    message: string;
    critical: boolean;
  }>;
  missingPrerequisites: string[];
};

type BranchOperationsDashboard = {
  branch: {
    id: number;
    name: string;
    code: string | null;
    city: string;
    cityName: string;
    isCompanyOperated: boolean;
    franchiseeName: string | null;
    status: string;
    isActive: boolean;
  };
  metrics: {
    activeSubscriptions: number;
    todayAssigned: number;
    todayCompleted: number;
    todayPending: number;
    todayCna: number;
    todayMissed: number;
    completionRate: number;
    openExceptionsCount: number;
    renewalsDueCount: number;
    invoicedRevenue: number;
    collectedRevenue: number;
    outstandingDues: number;
    collectionEfficiency: number;
  };
  cleaners: Array<{
    staffId: number;
    staffName: string;
    assignedVisits: number;
    completedVisits: number;
    cnaVisits: number;
    completionRate: number;
  }>;
  prioritizedActions: Array<{
    id: string;
    priority: "high" | "medium" | "low";
    category: string;
    title: string;
    description: string;
    actionUrl: string;
    count?: number;
  }>;
};

type BranchForm = {
  name: string;
  code: string;
  city: string;
  cityId: string;
  address: string;
  phone: string;
  managerName: string;
  isCompanyOperated: boolean;
  franchiseeId: string;
  legalEntityId: string;
  operationalNotes: string;
  isActive: boolean;
};

const emptyForm = (): BranchForm => ({
  name: "",
  code: "",
  city: "",
  cityId: "",
  address: "",
  phone: "",
  managerName: "",
  isCompanyOperated: true,
  franchiseeId: "",
  legalEntityId: "",
  operationalNotes: "",
  isActive: true,
});

async function fetchBranches(cityId?: string): Promise<BranchItem[]> {
  const url = new URL("/api/branches", window.location.origin);
  if (cityId && cityId !== "all") url.searchParams.set("cityId", cityId);
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load branches");
  return res.json();
}

async function fetchLegalEntities(): Promise<Array<{ id: number; name: string; code: string }>> {
  const res = await fetch("/api/legal-entities", { credentials: "include" });
  if (!res.ok) return [];
  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

async function fetchFranchisees(): Promise<Array<{ id: number; name: string }>> {
  const res = await fetch("/api/franchisees", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export default function BranchesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedCityId, setSelectedCityId] = useState<string>("all");

  const citiesQuery = useMasterList<City>("cities");
  const legalEntitiesQuery = useQuery({ queryKey: ["legal-entities"], queryFn: fetchLegalEntities });
  const franchiseesQuery = useQuery({ queryKey: ["franchisees"], queryFn: fetchFranchisees });
  const legalEntitiesList = Array.isArray(legalEntitiesQuery.data) ? legalEntitiesQuery.data : [];

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches", selectedCityId],
    queryFn: () => fetchBranches(selectedCityId),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<BranchForm>(emptyForm());
  const [createPhoneError, setCreatePhoneError] = useState<string | null>(null);

  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [editForm, setEditForm] = useState<BranchForm>(emptyForm());
  const [editPhoneError, setEditPhoneError] = useState<string | null>(null);

  const [suspendModal, setSuspendModal] = useState<BranchItem | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Readiness Checklist Dialog
  const [readinessModal, setReadinessModal] = useState<BranchItem | null>(null);
  const [readinessData, setReadinessData] = useState<BranchReadinessReport | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  // Operations Hub Dialog
  const [opsHubModal, setOpsHubModal] = useState<BranchItem | null>(null);
  const [opsHubData, setOpsHubData] = useState<BranchOperationsDashboard | null>(null);
  const [opsHubLoading, setOpsHubLoading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["branches"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  };

  const openReadiness = async (b: BranchItem) => {
    setReadinessModal(b);
    setReadinessLoading(true);
    try {
      const res = await fetch(`/api/branches/${b.id}/readiness`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load readiness report");
      const data = await res.json();
      setReadinessData(data);
    } catch (err: any) {
      toast({ title: "Failed to load checklist", description: err.message, variant: "destructive" });
    } finally {
      setReadinessLoading(false);
    }
  };

  const openOpsHub = async (b: BranchItem) => {
    setOpsHubModal(b);
    setOpsHubLoading(true);
    try {
      const res = await fetch(`/api/branches/${b.id}/operations-hub`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load operations dashboard");
      const data = await res.json();
      setOpsHubData(data);
    } catch (err: any) {
      toast({ title: "Failed to load operations hub", description: err.message, variant: "destructive" });
    } finally {
      setOpsHubLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.city) {
      toast({ title: "Branch name and city are required", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: createForm.name.trim(),
          code: createForm.code.trim() || undefined,
          city: createForm.city.trim(),
          cityId: createForm.cityId ? parseInt(createForm.cityId) : undefined,
          address: createForm.address.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
          managerName: createForm.managerName.trim() || undefined,
          isCompanyOperated: createForm.isCompanyOperated,
          franchiseeId: createForm.franchiseeId ? parseInt(createForm.franchiseeId) : undefined,
          legalEntityId: createForm.legalEntityId ? parseInt(createForm.legalEntityId) : undefined,
          operationalNotes: createForm.operationalNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create branch");
      }
      invalidate();
      setCreateOpen(false);
      setCreateForm(emptyForm());
      toast({ title: "Branch created successfully" });
    } catch (err: any) {
      toast({ title: "Failed to create branch", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editingBranch) return;
    try {
      const res = await fetch(`/api/branches/${editingBranch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim() || undefined,
          city: editForm.city.trim(),
          cityId: editForm.cityId ? parseInt(editForm.cityId) : null,
          address: editForm.address.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          managerName: editForm.managerName.trim() || undefined,
          isCompanyOperated: editForm.isCompanyOperated,
          franchiseeId: editForm.franchiseeId ? parseInt(editForm.franchiseeId) : null,
          legalEntityId: editForm.legalEntityId ? parseInt(editForm.legalEntityId) : null,
          operationalNotes: editForm.operationalNotes.trim() || undefined,
          isActive: editForm.isActive,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update branch");
      }
      invalidate();
      setEditingBranch(null);
      toast({ title: "Branch updated successfully" });
    } catch (err: any) {
      toast({ title: "Failed to update branch", description: err.message, variant: "destructive" });
    }
  };

  const handleSuspend = async () => {
    if (!suspendModal || !suspendReason.trim()) {
      toast({ title: "Please provide a suspension reason", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/branches/${suspendModal.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: suspendReason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to suspend branch");
      }
      invalidate();
      setSuspendModal(null);
      setSuspendReason("");
      toast({ title: "Branch suspended", description: "All active staff sessions revoked" });
    } catch (err: any) {
      toast({ title: "Suspension failed", description: err.message, variant: "destructive" });
    }
  };

  const handleActivate = async (branchId: number, force = false) => {
    try {
      const res = await fetch(`/api/branches/${branchId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // If failed because not ready, automatically open readiness modal
        const target = branches.find((b) => b.id === branchId);
        if (target) openReadiness(target);
        throw new Error(body.error || "Failed to activate branch");
      }
      invalidate();
      setReadinessModal(null);
      toast({ title: "Branch activated successfully" });
    } catch (err: any) {
      toast({ title: "Activation blocked", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="font-display font-bold text-2xl">Branches & Service Hubs</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Company-Operated (COCO) and Franchise-Operated (FOFO) service centers across cities.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {citiesQuery.data?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateOpen(true)} className="h-9">
              <Plus size={15} className="mr-1.5" /> Add Branch
            </Button>
          </div>
        </div>

        {/* Branch Cards Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 w-full rounded-2xl" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="p-12 text-center border rounded-2xl bg-card text-muted-foreground">
            No branches found for the selected city.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {branches.map((b) => (
              <div
                key={b.id}
                className={`bg-card border rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between ${
                  b.status === "suspended" ? "border-rose-400 bg-rose-50/10" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base text-foreground">{b.name}</h3>
                        <Badge
                          variant={b.isCompanyOperated ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {b.isCompanyOperated ? "COCO" : "FOFO Franchise"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.cityName || b.city} • Code: {b.code || `BR-${b.id}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        b.status === "suspended"
                          ? "destructive"
                          : b.status === "onboarding"
                          ? "outline"
                          : b.isActive
                          ? "default"
                          : "secondary"
                      }
                      className="text-xs shrink-0 capitalize"
                    >
                      {b.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {b.address && (
                      <p className="truncate">
                        <MapPin className="inline h-3 w-3 mr-1" />
                        {b.address}
                      </p>
                    )}
                    {b.managerName && (
                      <p>
                        Manager: <strong className="text-foreground">{b.managerName}</strong>
                      </p>
                    )}
                    {b.phone && <p>Phone: {b.phone}</p>}
                    {b.legalEntityName && (
                      <p className="text-primary font-medium">Billing Entity: {b.legalEntityName}</p>
                    )}
                    {!b.isCompanyOperated && b.franchiseeName && (
                      <p className="text-amber-600 font-medium">Franchise Partner: {b.franchiseeName}</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 bg-muted/40 rounded-lg">
                    <div>
                      <p className="text-muted-foreground">Active DCC</p>
                      <p className="font-bold text-foreground mt-0.5">{b.activeSubscriptionsCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Customers</p>
                      <p className="font-bold text-foreground mt-0.5">{b.customerCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Staff</p>
                      <p className="font-bold text-foreground mt-0.5">{b.staffCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-primary px-2"
                      onClick={() => openOpsHub(b)}
                    >
                      <Activity className="h-3.5 w-3.5 mr-1" /> Ops Hub
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2"
                        onClick={() => openReadiness(b)}
                        title="Check setup prerequisites"
                      >
                        Checklist
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2"
                        onClick={() => {
                          setEditingBranch(b);
                          setEditForm({
                            name: b.name,
                            code: b.code || "",
                            city: b.city,
                            cityId: b.cityId ? String(b.cityId) : "",
                            address: b.address || "",
                            phone: b.phone || "",
                            managerName: b.managerName || "",
                            isCompanyOperated: b.isCompanyOperated,
                            franchiseeId: b.franchiseeId ? String(b.franchiseeId) : "",
                            legalEntityId: b.legalEntityId ? String(b.legalEntityId) : "",
                            operationalNotes: b.operationalNotes || "",
                            isActive: b.isActive,
                          });
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>

                      {b.status !== "active" ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 px-2"
                          onClick={() => handleActivate(b.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 text-rose-600 hover:bg-rose-50 px-2"
                          onClick={() => {
                            setSuspendModal(b);
                            setSuspendReason("");
                          }}
                        >
                          <ShieldAlert className="h-3 w-3 mr-1" /> Suspend
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Branch Operations Command Center Dialog */}
        <Dialog open={opsHubModal != null} onOpenChange={(open) => !open && setOpsHubModal(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {opsHubModal?.name} — Operations Command Center
                </DialogTitle>
                <Badge variant={opsHubModal?.isCompanyOperated ? "secondary" : "outline"} className="text-xs">
                  {opsHubModal?.isCompanyOperated ? "COCO" : "FOFO"}
                </Badge>
              </div>
              <DialogDescription>
                Live operational status, cleaner workload, and prioritized branch actions.
              </DialogDescription>
            </DialogHeader>

            {opsHubLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading operations telemetry…</div>
            ) : opsHubData ? (
              <div className="space-y-4 pt-2">
                {/* Metrics 4-Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-muted/40 rounded-xl border">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Active DCC</p>
                    <p className="font-display font-bold text-xl text-foreground mt-1">
                      {opsHubData.metrics.activeSubscriptions}
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                    <p className="text-[11px] text-green-600 uppercase font-semibold">Completed Today</p>
                    <p className="font-display font-bold text-xl text-green-600 mt-1">
                      {opsHubData.metrics.todayCompleted}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({opsHubData.metrics.completionRate}%)
                      </span>
                    </p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <p className="text-[11px] text-amber-600 uppercase font-semibold">CNA Visits</p>
                    <p className="font-display font-bold text-xl text-amber-600 mt-1">
                      {opsHubData.metrics.todayCna}
                    </p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <p className="text-[11px] text-primary uppercase font-semibold">Pending Cleanings</p>
                    <p className="font-display font-bold text-xl text-primary mt-1">
                      {opsHubData.metrics.todayPending}
                    </p>
                  </div>
                </div>

                {/* Prioritized Actions Queue */}
                {opsHubData.prioritizedActions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                      Prioritized Operations Actions
                    </h4>
                    <div className="space-y-2">
                      {opsHubData.prioritizedActions.map((action) => (
                        <div
                          key={action.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            action.priority === "high"
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-700"
                              : action.priority === "medium"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
                              : "bg-muted/40 border-border text-foreground"
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{action.title}</p>
                            <p className="text-[11px] opacity-90 mt-0.5">{action.description}</p>
                          </div>
                          <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" asChild>
                            <a href={action.actionUrl}>Resolve</a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cleaners on Duty */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">Cleaners on Duty</h4>
                  {opsHubData.cleaners.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No active cleaners assigned to this branch.</p>
                  ) : (
                    <div className="divide-y divide-border border rounded-xl overflow-hidden text-xs">
                      <div className="grid grid-cols-12 bg-muted/50 p-2.5 font-semibold text-muted-foreground">
                        <span className="col-span-5">Cleaner Name</span>
                        <span className="col-span-3 text-center">Assigned Visits</span>
                        <span className="col-span-2 text-right">Done</span>
                        <span className="col-span-2 text-right">CNA</span>
                      </div>
                      {opsHubData.cleaners.map((c) => (
                        <div key={c.staffId} className="grid grid-cols-12 p-2.5 items-center">
                          <span className="col-span-5 font-medium">{c.staffName}</span>
                          <span className="col-span-3 text-center text-muted-foreground">{c.assignedVisits}</span>
                          <span className="col-span-2 text-right text-green-600 font-semibold">{c.completedVisits}</span>
                          <span className="col-span-2 text-right text-amber-600 font-semibold">{c.cnaVisits}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/20 border rounded-xl text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">Invoiced</p>
                    <p className="font-bold mt-0.5">₹{opsHubData.metrics.invoicedRevenue.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-primary font-medium">Collected</p>
                    <p className="font-bold text-primary mt-0.5">₹{opsHubData.metrics.collectedRevenue.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-rose-600 font-medium">Overdue Dues</p>
                    <p className="font-bold text-rose-600 mt-0.5">₹{opsHubData.metrics.outstandingDues.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Readiness Checklist Dialog */}
        <Dialog open={readinessModal != null} onOpenChange={(open) => !open && setReadinessModal(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Setup Readiness — {readinessModal?.name}
              </DialogTitle>
              <DialogDescription>
                Verification checklist required before activating branch operations.
              </DialogDescription>
            </DialogHeader>

            {readinessLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Evaluating setup prerequisites…</div>
            ) : readinessData ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Readiness Score</p>
                    <p className="font-display font-bold text-2xl text-foreground mt-0.5">{readinessData.score}%</p>
                  </div>
                  <Badge variant={readinessData.isReady ? "default" : "destructive"} className="text-xs">
                    {readinessData.isReady ? "Ready for Activation" : "Incomplete Setup"}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {readinessData.checklist.map((item) => (
                    <div
                      key={item.key}
                      className="p-2.5 rounded-lg border text-xs flex items-start gap-2.5 bg-card"
                    >
                      {item.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground">{item.label}</p>
                          {item.critical && (
                            <span className="text-[10px] text-amber-600 uppercase font-medium">Critical</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.message}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <DialogFooter className="flex gap-2 sm:justify-between items-center pt-2">
                  <Button variant="outline" size="sm" onClick={() => setReadinessModal(null)}>
                    Close
                  </Button>
                  <div className="flex gap-2">
                    {!readinessData.isReady && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-amber-600 hover:text-amber-700"
                        onClick={() => handleActivate(readinessData.branchId, true)}
                      >
                        Force Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      disabled={!readinessData.isReady}
                      onClick={() => handleActivate(readinessData.branchId, false)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Activation
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Create Branch Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Register Branch / Service Center</DialogTitle>
              <DialogDescription>
                Configure a new company-operated or franchise-operated service center.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Branch Name *</Label>
                  <Input
                    placeholder="e.g. Noida Sector 62 Hub"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Branch Code</Label>
                  <Input
                    placeholder="e.g. BR-NOI-01"
                    value={createForm.code}
                    onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">City Name *</Label>
                  <Input
                    placeholder="City"
                    value={createForm.city}
                    onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City Mapping</Label>
                  <Select
                    value={createForm.cityId}
                    onValueChange={(val) => {
                      const city = citiesQuery.data?.find((c) => String(c.id) === val);
                      setCreateForm((f) => ({
                        ...f,
                        cityId: val,
                        city: city ? city.name : f.city,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {citiesQuery.data?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Operating Model</Label>
                  <Select
                    value={createForm.isCompanyOperated ? "coco" : "fofo"}
                    onValueChange={(v) =>
                      setCreateForm((f) => ({
                        ...f,
                        isCompanyOperated: v === "coco",
                        franchiseeId: v === "coco" ? "" : f.franchiseeId,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coco">Company-Operated (COCO)</SelectItem>
                      <SelectItem value="fofo">Franchise-Operated (FOFO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Billing Legal Entity</Label>
                  <Select
                    value={createForm.legalEntityId}
                    onValueChange={(val) => setCreateForm((f) => ({ ...f, legalEntityId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select legal entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {legalEntitiesList.map((le) => (
                        <SelectItem key={le.id} value={String(le.id)}>
                          {le.name} ({le.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!createForm.isCompanyOperated && (
                <div className="space-y-1">
                  <Label className="text-xs">Franchise Partner *</Label>
                  <Select
                    value={createForm.franchiseeId}
                    onValueChange={(val) => setCreateForm((f) => ({ ...f, franchiseeId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select franchise partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchiseesQuery.data?.map((fr) => (
                        <SelectItem key={fr.id} value={String(fr.id)}>
                          {fr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Manager Name</Label>
                  <Input
                    placeholder="Branch Manager"
                    value={createForm.managerName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, managerName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <PhoneInput
                    label="Phone"
                    optional
                    value={createForm.phone}
                    onChange={(v) => setCreateForm((f) => ({ ...f, phone: v }))}
                    error={createPhoneError}
                    onErrorChange={setCreatePhoneError}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Operational Notes</Label>
                <Input
                  placeholder="Service area, society coverage, or parking notes"
                  value={createForm.operationalNotes}
                  onChange={(e) => setCreateForm((f) => ({ ...f, operationalNotes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Save Branch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Branch Dialog */}
        <Dialog open={editingBranch != null} onOpenChange={(open) => !open && setEditingBranch(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Branch: {editingBranch?.name}</DialogTitle>
              <DialogDescription>Update branch settings, legal entity, and operating model.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Branch Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Branch Code</Label>
                  <Input
                    value={editForm.code}
                    onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Operating Model</Label>
                  <Select
                    value={editForm.isCompanyOperated ? "coco" : "fofo"}
                    onValueChange={(v) =>
                      setEditForm((f) => ({
                        ...f,
                        isCompanyOperated: v === "coco",
                        franchiseeId: v === "coco" ? "" : f.franchiseeId,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coco">Company-Operated (COCO)</SelectItem>
                      <SelectItem value="fofo">Franchise-Operated (FOFO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Billing Legal Entity</Label>
                  <Select
                    value={editForm.legalEntityId}
                    onValueChange={(val) => setEditForm((f) => ({ ...f, legalEntityId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select legal entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {legalEntitiesList.map((le) => (
                        <SelectItem key={le.id} value={String(le.id)}>
                          {le.name} ({le.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!editForm.isCompanyOperated && (
                <div className="space-y-1">
                  <Label className="text-xs">Franchise Partner</Label>
                  <Select
                    value={editForm.franchiseeId}
                    onValueChange={(val) => setEditForm((f) => ({ ...f, franchiseeId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select franchise partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchiseesQuery.data?.map((fr) => (
                        <SelectItem key={fr.id} value={String(fr.id)}>
                          {fr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Manager Name</Label>
                  <Input
                    value={editForm.managerName}
                    onChange={(e) => setEditForm((f) => ({ ...f, managerName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <PhoneInput
                    label="Phone"
                    optional
                    value={editForm.phone}
                    onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                    error={editPhoneError}
                    onErrorChange={setEditPhoneError}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBranch(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Update Branch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Branch Modal */}
        <Dialog open={suspendModal != null} onOpenChange={(open) => !open && setSuspendModal(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-rose-600 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Suspend Branch: {suspendModal?.name}
              </DialogTitle>
              <DialogDescription>
                Suspending this branch will revoke active sessions for all its staff and cleaners, freeze daily
                routes, and halt new bookings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Label className="text-xs">Mandatory Suspension Reason *</Label>
              <Input
                placeholder="e.g. Contract audit failure, license hold, or facility closure"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendModal(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSuspend}>
                Confirm Suspension
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
