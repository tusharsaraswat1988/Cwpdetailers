import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Plus,
  Pencil,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  Landmark,
  FileText,
  Loader2,
  AlertCircle,
  Hash,
} from "lucide-react";

export type LegalEntity = {
  id: number;
  code: string;
  name: string;
  tradeName?: string | null;
  entityType: "company_owned" | "franchise";
  gstin?: string | null;
  panNumber?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
  defaultSac?: string | null;
  invoicePrefix?: string | null;
  termsAndConditions?: string[] | null;
  isActive: boolean;
  isDefault: boolean;
  branches?: Array<{
    id: number;
    name: string;
    city?: string | null;
    isPrimary?: boolean | null;
  }>;
  sequences?: Array<{
    documentType: string;
    financialYear: string;
    currentValue: number;
    prefix?: string | null;
  }>;
};

type Branch = {
  id: number;
  name: string;
  city?: string | null;
  legalEntityId?: number | null;
};

const LEGAL_ENTITIES_QUERY_KEY = ["legal-entities"];
const BRANCHES_QUERY_KEY = ["branches"];

const emptyEntityForm = () => ({
  code: "",
  name: "",
  tradeName: "",
  entityType: "company_owned" as "company_owned" | "franchise",
  gstin: "",
  panNumber: "",
  stateCode: "09",
  stateName: "Uttar Pradesh",
  addressLine1: "",
  addressLine2: "",
  city: "",
  pincode: "",
  phone: "",
  email: "",
  website: "",
  bankAccountName: "",
  bankName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  upiId: "",
  defaultSac: "998533",
  invoicePrefix: "CWP",
  termsText: "",
  isActive: true,
  isDefault: false,
});

export function LegalEntitiesManager() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<LegalEntity | null>(null);
  const [formData, setFormData] = useState(emptyEntityForm());

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningEntity, setAssigningEntity] = useState<LegalEntity | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  // Fetch Legal Entities
  const { data: entitiesData, isLoading: entitiesLoading } = useQuery<{ legalEntities: LegalEntity[] }>({
    queryKey: LEGAL_ENTITIES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/legal-entities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load legal entities");
      return res.json();
    },
  });

  // Fetch Branches for Assignment
  const { data: branchesData } = useQuery<{ branches?: Branch[] } | Branch[]>({
    queryKey: BRANCHES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load branches");
      return res.json();
    },
  });

  const branches: Branch[] = Array.isArray(branchesData)
    ? branchesData
    : branchesData?.branches ?? [];

  // Create or Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof emptyEntityForm> & { id?: number }) => {
      const isEdit = Boolean(payload.id);
      const url = isEdit ? `/api/legal-entities/${payload.id}` : "/api/legal-entities";
      const method = isEdit ? "PATCH" : "POST";

      const terms = payload.termsText
        ? payload.termsText.split("\n").map(s => s.trim()).filter(Boolean)
        : [];

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          termsAndConditions: terms,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save legal entity");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEGAL_ENTITIES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
      setDialogOpen(false);
      setEditingEntity(null);
      toast({
        title: editingEntity ? "Legal entity updated" : "Legal entity registered",
        description: "Billing & invoice configurations saved successfully.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  // Set Default Mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/legal-entities/${id}/set-default`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to set default entity");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEGAL_ENTITIES_QUERY_KEY });
      toast({ title: "Default billing entity updated", description: "Invoices with unassigned branches will use this entity." });
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  // Assign Branches Mutation
  const assignBranchesMutation = useMutation({
    mutationFn: async ({ id, branchIds }: { id: number; branchIds: number[] }) => {
      const res = await fetch(`/api/legal-entities/${id}/assign-branches`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchIds }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to assign branches");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEGAL_ENTITIES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
      setAssignDialogOpen(false);
      setAssigningEntity(null);
      toast({ title: "Branches mapped", description: "Branch invoices will now issue under this legal entity." });
    },
    onError: (err: Error) => {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenAdd = () => {
    setEditingEntity(null);
    setFormData(emptyEntityForm());
    setDialogOpen(true);
  };

  const handleOpenEdit = (entity: LegalEntity) => {
    setEditingEntity(entity);
    setFormData({
      code: entity.code,
      name: entity.name,
      tradeName: entity.tradeName || "",
      entityType: entity.entityType,
      gstin: entity.gstin || "",
      panNumber: entity.panNumber || "",
      stateCode: entity.stateCode || "09",
      stateName: entity.stateName || "Uttar Pradesh",
      addressLine1: entity.addressLine1 || "",
      addressLine2: entity.addressLine2 || "",
      city: entity.city || "",
      pincode: entity.pincode || "",
      phone: entity.phone || "",
      email: entity.email || "",
      website: entity.website || "",
      bankAccountName: entity.bankAccountName || "",
      bankName: entity.bankName || "",
      bankAccountNumber: entity.bankAccountNumber || "",
      bankIfsc: entity.bankIfsc || "",
      upiId: entity.upiId || "",
      defaultSac: entity.defaultSac || "998533",
      invoicePrefix: entity.invoicePrefix || "CWP",
      termsText: (entity.termsAndConditions || []).join("\n"),
      isActive: entity.isActive,
      isDefault: entity.isDefault,
    });
    setDialogOpen(true);
  };

  const handleOpenAssign = (entity: LegalEntity) => {
    setAssigningEntity(entity);
    const assignedIds = (entity.branches || []).map(b => b.id);
    setSelectedBranchIds(assignedIds);
    setAssignDialogOpen(true);
  };

  const entities = entitiesData?.legalEntities ?? [];

  return (
    <div className="space-y-6" data-testid="legal-entities-manager">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="text-primary" size={20} />
            Responsible Legal & Billing Entities
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure company-operated and franchise legal entities. Each entity has its own GSTIN, billing address, bank account, and dedicated invoice numbering series.
          </p>
        </div>
        <Button onClick={handleOpenAdd} data-testid="btn-add-legal-entity">
          <Plus size={16} className="mr-1.5" /> Add Legal Entity
        </Button>
      </div>

      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-900 dark:text-blue-200 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
          Multi-City Architecture Compliance
        </p>
        <p>
          A city is an operational geography, not automatically a legal entity. Multiple branches or cities can be served by one corporate entity, while franchise territories issue invoices under their respective franchise legal entities.
        </p>
      </div>

      {entitiesLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : entities.length === 0 ? (
        <Card className="text-center p-8 text-muted-foreground">
          <AlertCircle className="mx-auto mb-2 text-muted-foreground/60" size={32} />
          <p className="font-medium">No legal entities configured.</p>
          <p className="text-sm">Add a corporate or franchise entity to manage multi-entity billing.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entities.map(entity => (
            <Card key={entity.id} className="relative overflow-hidden transition-all hover:border-primary/40">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base font-bold">{entity.name}</CardTitle>
                      {entity.tradeName && entity.tradeName !== entity.name && (
                        <span className="text-xs text-muted-foreground font-normal">
                          (t/a {entity.tradeName})
                        </span>
                      )}
                      <Badge variant={entity.entityType === "company_owned" ? "default" : "secondary"}>
                        {entity.entityType === "company_owned" ? "Company Operated" : "Franchise Entity"}
                      </Badge>
                      {entity.isDefault && (
                        <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 gap-1 font-medium">
                          <CheckCircle2 size={12} /> Default Entity
                        </Badge>
                      )}
                      {!entity.isActive && (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono">
                      <span>Code: <strong>{entity.code}</strong></span>
                      {entity.gstin && <span>GSTIN: <strong>{entity.gstin}</strong></span>}
                      {entity.panNumber && <span>PAN: <strong>{entity.panNumber}</strong></span>}
                      <span>State: {entity.stateCode || "09"} ({entity.stateName || "Uttar Pradesh"})</span>
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAssign(entity)}
                      className="text-xs"
                      title="Map operational branches to this billing entity"
                    >
                      <GitBranch size={13} className="mr-1" />
                      Map Branches ({(entity.branches || []).length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(entity)}
                      className="text-xs"
                    >
                      <Pencil size={13} className="mr-1" />
                      Edit
                    </Button>
                    {!entity.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={setDefaultMutation.isPending}
                        onClick={() => setDefaultMutation.mutate(entity.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Set Default
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="text-xs space-y-3 pt-0">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block">Billing Address</span>
                    <span className="font-medium text-foreground">
                      {[entity.addressLine1, entity.city, entity.pincode].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Invoice Prefix & Numbering</span>
                    <span className="font-medium text-foreground font-mono">
                      Prefix: {entity.invoicePrefix || "CWP"} / FY / Seq
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Bank & UPI</span>
                    <span className="font-medium text-foreground">
                      {entity.bankName ? `${entity.bankName} (${entity.bankIfsc || "IFSC"})` : (entity.upiId || "—")}
                    </span>
                  </div>
                </div>

                {/* Assigned branches pills */}
                <div>
                  <span className="text-muted-foreground block mb-1 font-medium">
                    Assigned Branches:
                  </span>
                  {(entity.branches || []).length === 0 ? (
                    <span className="text-muted-foreground italic">
                      No branches explicitly mapped. {entity.isDefault ? "(Handles all unassigned branches)" : ""}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {entity.branches?.map(b => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-background border border-border shadow-xs"
                        >
                          <GitBranch size={10} className="text-primary" />
                          {b.name} {b.city ? `(${b.city})` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sequences info */}
                {(entity.sequences || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono border-t border-border/40 pt-2">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Hash size={12} /> Live Sequence Counters:
                    </span>
                    {entity.sequences?.map((s, idx) => (
                      <span key={idx} className="bg-background px-2 py-0.5 rounded border border-border">
                        {s.documentType.toUpperCase()} ({s.financialYear}): Next #<strong>{s.currentValue + 1}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Entity Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntity ? "Edit Legal Entity" : "Register Legal Entity"}
            </DialogTitle>
            <DialogDescription>
              Configure the responsible company or franchise entity, GSTIN, and tax invoice series.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Entity Code</Label>
                <Input
                  value={formData.code}
                  onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
                  placeholder="e.g. CWP_HQ or CWP_NDA"
                  className="font-mono mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Entity Type</Label>
                <Select
                  value={formData.entityType}
                  onValueChange={v => setFormData(f => ({ ...f, entityType: v as "company_owned" | "franchise" }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_owned">Company Owned & Operated</SelectItem>
                    <SelectItem value="franchise">Franchise Operated Entity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Legal Registered Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. CWP Clean Wheels Pvt Ltd"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Trade / Brand Name</Label>
                <Input
                  value={formData.tradeName}
                  onChange={e => setFormData(f => ({ ...f, tradeName: e.target.value }))}
                  placeholder="e.g. CWP Detailers"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>GSTIN</Label>
                <Input
                  value={formData.gstin}
                  onChange={e => setFormData(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                  placeholder="09AAAAA0000A1Z5"
                  className="font-mono mt-1"
                />
              </div>
              <div>
                <Label>PAN</Label>
                <Input
                  value={formData.panNumber}
                  onChange={e => setFormData(f => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
                  placeholder="AAAAA0000A"
                  className="font-mono mt-1"
                />
              </div>
              <div>
                <Label>State Code</Label>
                <Input
                  value={formData.stateCode}
                  onChange={e => setFormData(f => ({ ...f, stateCode: e.target.value }))}
                  placeholder="09"
                  className="font-mono mt-1"
                />
              </div>
              <div>
                <Label>State Name</Label>
                <Input
                  value={formData.stateName}
                  onChange={e => setFormData(f => ({ ...f, stateName: e.target.value }))}
                  placeholder="Uttar Pradesh"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Billing Address Line 1</Label>
              <Input
                value={formData.addressLine1}
                onChange={e => setFormData(f => ({ ...f, addressLine1: e.target.value }))}
                placeholder="Building, street, sector/area"
                className="mt-1"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={e => setFormData(f => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Noida or Varanasi"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={formData.pincode}
                  onChange={e => setFormData(f => ({ ...f, pincode: e.target.value }))}
                  placeholder="201301"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Invoice Prefix</Label>
                <Input
                  value={formData.invoicePrefix}
                  onChange={e => setFormData(f => ({ ...f, invoicePrefix: e.target.value.toUpperCase().replace(/\s+/g, "-") }))}
                  placeholder="e.g. CWP or CWP-NDA"
                  className="font-mono mt-1"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Billing Email</Label>
                <Input
                  value={formData.email}
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                  placeholder="billing@..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Default SAC Code</Label>
                <Input
                  value={formData.defaultSac}
                  onChange={e => setFormData(f => ({ ...f, defaultSac: e.target.value }))}
                  placeholder="998533"
                  className="font-mono mt-1"
                />
              </div>
            </div>

            {/* Bank details */}
            <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Landmark size={14} className="text-primary" /> Bank & Settlement Details
              </span>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Bank Account Name</Label>
                  <Input
                    value={formData.bankAccountName}
                    onChange={e => setFormData(f => ({ ...f, bankAccountName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Bank Name & Branch</Label>
                  <Input
                    value={formData.bankName}
                    onChange={e => setFormData(f => ({ ...f, bankName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input
                    value={formData.bankAccountNumber}
                    onChange={e => setFormData(f => ({ ...f, bankAccountNumber: e.target.value }))}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label>IFSC Code</Label>
                  <Input
                    value={formData.bankIfsc}
                    onChange={e => setFormData(f => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))}
                    className="mt-1 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>UPI ID (Printed on invoice QR)</Label>
                  <Input
                    value={formData.upiId}
                    onChange={e => setFormData(f => ({ ...f, upiId: e.target.value }))}
                    placeholder="merchant@upi"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Terms & Conditions (One per line)</Label>
              <Textarea
                value={formData.termsText}
                onChange={e => setFormData(f => ({ ...f, termsText: e.target.value }))}
                placeholder="All disputes subject to Noida jurisdiction."
                className="mt-1 min-h-[80px] font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={c => setFormData(f => ({ ...f, isActive: c }))}
                  id="entity-active"
                />
                <Label htmlFor="entity-active" className="cursor-pointer">Active for invoicing</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={c => setFormData(f => ({ ...f, isDefault: c }))}
                  id="entity-default"
                />
                <Label htmlFor="entity-default" className="cursor-pointer">Default corporate entity</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate({
                ...formData,
                id: editingEntity?.id,
              })}
              disabled={saveMutation.isPending || !formData.code || !formData.name}
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {editingEntity ? "Update Entity" : "Register Entity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Branches Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Map Branches to {assigningEntity?.name}</DialogTitle>
            <DialogDescription>
              Select operational branches that will issue tax invoices under this legal entity.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-72 overflow-y-auto">
            {branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branches found.</p>
            ) : (
              branches.map(b => {
                const isChecked = selectedBranchIds.includes(b.id);
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer"
                    onClick={() => {
                      setSelectedBranchIds(prev =>
                        isChecked ? prev.filter(id => id !== b.id) : [...prev, b.id]
                      );
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {
                          setSelectedBranchIds(prev =>
                            isChecked ? prev.filter(id => id !== b.id) : [...prev, b.id]
                          );
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium">{b.name}</p>
                        {b.city && <p className="text-xs text-muted-foreground">{b.city}</p>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (assigningEntity) {
                  assignBranchesMutation.mutate({
                    id: assigningEntity.id,
                    branchIds: selectedBranchIds,
                  });
                }
              }}
              disabled={assignBranchesMutation.isPending}
            >
              {assignBranchesMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Save Branch Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
