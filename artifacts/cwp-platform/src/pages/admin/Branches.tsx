import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Users, UserCog, MoreHorizontal, Pencil, Trash2, Power, Building2, Car, ShieldAlert, CheckCircle2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { submitContactPhone } from "@/lib/contactForm";
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
  return res.json();
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["branches"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
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
      toast({ title: "Branch updated" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSuspend = async () => {
    if (!suspendModal || !suspendReason.trim()) return;
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

  const handleActivate = async (branchId: number) => {
    try {
      const res = await fetch(`/api/branches/${branchId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to activate branch");
      }
      invalidate();
      toast({ title: "Branch activated successfully" });
    } catch (err: any) {
      toast({ title: "Activation failed", description: err.message, variant: "destructive" });
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
                {citiesQuery.data?.map(c => (
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
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
          </div>
        ) : branches.length === 0 ? (
          <div className="p-12 text-center border rounded-2xl bg-card text-muted-foreground">
            No branches found for the selected city.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {branches.map(b => (
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
                          : b.isActive
                          ? "default"
                          : "secondary"
                      }
                      className="text-xs shrink-0"
                    >
                      {b.status === "suspended" ? "Suspended" : b.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {b.address && <p className="truncate"><MapPin className="inline h-3 w-3 mr-1" />{b.address}</p>}
                    {b.managerName && <p>Manager: <strong className="text-foreground">{b.managerName}</strong></p>}
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

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
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
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>

                    {b.status === "suspended" ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleActivate(b.id)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Activate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 text-rose-600 hover:bg-rose-50"
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
            ))}
          </div>
        )}

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
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Branch Code</Label>
                  <Input
                    placeholder="e.g. BR-NOI-01"
                    value={createForm.code}
                    onChange={e => setCreateForm(f => ({ ...f, code: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Jurisdiction City *</Label>
                  <Select
                    value={createForm.cityId}
                    onValueChange={val => {
                      const found = citiesQuery.data?.find(c => String(c.id) === val);
                      setCreateForm(f => ({ ...f, cityId: val, city: found?.name || f.city }));
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select City" />
                    </SelectTrigger>
                    <SelectContent>
                      {citiesQuery.data?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Billing Legal Entity</Label>
                  <Select
                    value={createForm.legalEntityId}
                    onValueChange={val => setCreateForm(f => ({ ...f, legalEntityId: val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select Legal Entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {legalEntitiesQuery.data?.map(le => (
                        <SelectItem key={le.id} value={String(le.id)}>{le.name} ({le.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <Label className="text-xs font-semibold">Operating Model</Label>
                  <p className="text-xs text-muted-foreground">
                    {createForm.isCompanyOperated ? "Company-Operated (COCO)" : "Franchise-Operated (FOFO)"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">FOFO</span>
                  <Switch
                    checked={createForm.isCompanyOperated}
                    onCheckedChange={checked => setCreateForm(f => ({ ...f, isCompanyOperated: checked }))}
                  />
                  <span className="text-xs font-medium">COCO</span>
                </div>
              </div>

              {!createForm.isCompanyOperated && (
                <div className="space-y-1">
                  <Label className="text-xs">Franchise Partner</Label>
                  <Select
                    value={createForm.franchiseeId}
                    onValueChange={val => setCreateForm(f => ({ ...f, franchiseeId: val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Link to Franchisee" />
                    </SelectTrigger>
                    <SelectContent>
                      {franchiseesQuery.data?.map(fr => (
                        <SelectItem key={fr.id} value={String(fr.id)}>{fr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Address / Base Location</Label>
                  <Input
                    placeholder="Sector 62, Noida"
                    value={createForm.address}
                    onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Manager Name</Label>
                  <Input
                    placeholder="Operational Manager"
                    value={createForm.managerName}
                    onChange={e => setCreateForm(f => ({ ...f, managerName: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreate}>Save Branch</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Suspend Modal */}
        <Dialog open={Boolean(suspendModal)} onOpenChange={open => !open && setSuspendModal(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-rose-600 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Suspend Branch
              </DialogTitle>
              <DialogDescription className="text-xs">
                Suspending <strong>{suspendModal?.name}</strong> will revoke active logins for branch staff and prevent new assignments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Label className="text-xs">Suspension Rationale / Audit Reason *</Label>
              <Input
                placeholder="Reason for suspension (audit logged)..."
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSuspendModal(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleSuspend}>Confirm Suspension</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
