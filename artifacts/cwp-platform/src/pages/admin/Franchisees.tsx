import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Key,
  ShieldAlert,
  FileText,
  Percent,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { submitEmail, submitMobile, submitOptionalMobile } from "@/lib/contactForm";
import { useBranding } from "@/lib/branding";

async function fetchFranchisees(cityId?: string) {
  const url = cityId ? `/api/franchisees?cityId=${cityId}` : "/api/franchisees";
  const res = await fetch(url);
  return res.json();
}

async function fetchBranches() {
  const res = await fetch("/api/branches");
  return res.json();
}

async function fetchCities() {
  const res = await fetch("/api/cities");
  return res.json();
}

async function fetchLegalEntities() {
  const res = await fetch("/api/legal-entities");
  return res.json();
}

async function createFranchisee(data: any) {
  const res = await fetch("/api/franchisees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create franchisee");
  }
  return res.json();
}

async function updateFranchisee(id: number, data: any) {
  const res = await fetch(`/api/franchisees/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update franchisee");
  }
  return res.json();
}

async function suspendFranchiseeApi(id: number, reason: string) {
  const res = await fetch(`/api/franchisees/${id}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to suspend franchisee");
  }
  return res.json();
}

async function activateFranchiseeApi(id: number) {
  const res = await fetch(`/api/franchisees/${id}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to activate franchisee");
  }
  return res.json();
}

async function createAccount(id: number, password: string) {
  const res = await fetch(`/api/franchisees/${id}/create-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create account");
  }
  return res.json();
}

async function resetPassword(id: number, password: string) {
  const res = await fetch(`/api/franchisees/${id}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to reset password");
  }
  return res.json();
}

const statusBadge: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  onboarding: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  suspended: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
  terminated: "bg-red-500/10 text-red-500 border-red-500/20",
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  secondaryPhone: "",
  branchId: "",
  cityId: "",
  legalEntityId: "",
  agreementNumber: "",
  commissionPercentage: "15.00",
  status: "onboarding",
  currentAddress: "",
  permanentAddress: "",
  aadhaar: "",
  pan: "",
  tenureStartDate: "",
  tenureEndDate: "",
  finalAmountAgreed: "",
  amountDeposited: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankName: "",
  notes: "",
};

export default function AdminFranchisees() {
  const branding = useBranding();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("all");
  const { data: franchisees = [], isLoading } = useQuery({
    queryKey: ["franchisees", selectedCityFilter],
    queryFn: () => fetchFranchisees(selectedCityFilter === "all" ? undefined : selectedCityFilter),
  });

  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: fetchCities });
  const { data: legalEntities = [] } = useQuery({ queryKey: ["legal-entities"], queryFn: fetchLegalEntities });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<{ phone?: string | null; email?: string | null; secondaryPhone?: string | null }>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  // Modals
  const [accountModal, setAccountModal] = useState<{ id: number; name: string; isReset?: boolean } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [suspendModal, setSuspendModal] = useState<{ id: number; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const createMut = useMutation({
    mutationFn: createFranchisee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["franchisees"] });
      qc.invalidateQueries({ queryKey: ["branches"] });
      setShowForm(false);
      setForm(emptyForm);
      toast({ title: "Franchisee record registered successfully" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to add franchisee", description: err.message, variant: "destructive" }),
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => suspendFranchiseeApi(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["franchisees"] });
      qc.invalidateQueries({ queryKey: ["branches"] });
      setSuspendModal(null);
      setSuspendReason("");
      toast({ title: "Franchisee suspended", description: "Operational sessions revoked." });
    },
    onError: (err: any) =>
      toast({ title: "Suspension failed", description: err.message, variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => activateFranchiseeApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["franchisees"] });
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast({ title: "Franchisee activated", description: "Operational status restored to active." });
    },
    onError: (err: any) =>
      toast({ title: "Activation failed", description: err.message, variant: "destructive" }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateFranchisee(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["franchisees"] });
      toast({ title: "Franchisee status updated" });
    },
    onError: (err: any) =>
      toast({ title: "Status update failed", description: err.message, variant: "destructive" }),
  });

  const accountMut = useMutation({
    mutationFn: ({ id, password, isReset }: { id: number; password: string; isReset?: boolean }) =>
      isReset ? resetPassword(id, password) : createAccount(id, password),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["franchisees"] });
      toast({
        title: vars.isReset ? "Password reset successfully" : "Franchise partner account created",
        description: `Phone: ${data.phone} · Credentials active`,
      });
      setAccountModal(null);
      setNewPassword("");
    },
    onError: (err: any) =>
      toast({ title: "Account action failed", description: err.message, variant: "destructive" }),
  });

  const f = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleCreate = () => {
    const phoneResult = submitMobile(form.phone);
    const emailResult = submitEmail(form.email);
    const secondaryResult = submitOptionalMobile(form.secondaryPhone);
    setErrors({
      phone: phoneResult.ok ? null : phoneResult.error,
      email: emailResult.ok ? null : emailResult.error,
      secondaryPhone: secondaryResult.ok ? null : secondaryResult.error,
    });
    if (!phoneResult.ok || !emailResult.ok || !secondaryResult.ok) {
      toast({ title: "Please fix phone or email format", variant: "destructive" });
      return;
    }
    createMut.mutate({
      ...form,
      phone: phoneResult.value,
      email: emailResult.value,
      secondaryPhone: secondaryResult.value,
      branchId: form.branchId ? parseInt(form.branchId) : undefined,
      cityId: form.cityId ? parseInt(form.cityId) : undefined,
      legalEntityId: form.legalEntityId ? parseInt(form.legalEntityId) : undefined,
      commissionPercentage: form.commissionPercentage || "15.00",
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-2xl">Franchise Partners</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                FOFO Model
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Multi-city franchise operations — owned locally, governed by {branding.brandName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCityFilter}
              onChange={(e) => setSelectedCityFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">All Cities</option>
              {cities.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button onClick={() => setShowForm(!showForm)} className="bg-primary text-primary-foreground text-xs">
              <Plus size={14} className="mr-1.5" />
              Add Franchisee
            </Button>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h2 className="font-semibold text-base">New Franchise Partner Onboarding</h2>
              </div>
              <span className="text-xs text-muted-foreground">Sets up franchisee entity, city scoping &amp; agreements</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => f("name", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Partner full legal name"
                />
              </div>

              <PhoneInput
                label="Mobile Number *"
                value={form.phone}
                onChange={(v) => f("phone", v)}
                error={errors.phone}
                onErrorChange={(err) => setErrors((e) => ({ ...e, phone: err }))}
              />

              <EmailInput
                label="Email"
                optional
                value={form.email}
                onChange={(v) => f("email", v)}
                error={errors.email}
                onErrorChange={(err) => setErrors((e) => ({ ...e, email: err }))}
              />

              <PhoneInput
                label="Secondary Phone"
                optional
                value={form.secondaryPhone}
                onChange={(v) => f("secondaryPhone", v)}
                error={errors.secondaryPhone}
                onErrorChange={(err) => setErrors((e) => ({ ...e, secondaryPhone: err }))}
              />

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Assigned City</label>
                <select
                  value={form.cityId}
                  onChange={(e) => f("cityId", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select city (Optional)</option>
                  {cities.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Assigned Branch (FOFO)</label>
                <select
                  value={form.branchId}
                  onChange={(e) => f("branchId", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select branch (Optional)</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city}) {b.isCompanyOperated ? "• COCO" : "• FOFO"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Issuing Legal Entity</label>
                <select
                  value={form.legalEntityId}
                  onChange={(e) => f("legalEntityId", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select legal entity (Optional)</option>
                  {legalEntities.map((le: any) => (
                    <option key={le.id} value={le.id}>
                      {le.name} ({le.gstin || "No GSTIN"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Agreement Number</label>
                <input
                  value={form.agreementNumber}
                  onChange={(e) => f("agreementNumber", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="e.g. CWP-FRAN-NOI-2026-01"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Revenue Commission (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.commissionPercentage}
                  onChange={(e) => f("commissionPercentage", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="15.00"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Lifecycle Status</label>
                <select
                  value={form.status}
                  onChange={(e) => f("status", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="onboarding">Onboarding</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {[
                ["tenureStartDate", "Tenure Start Date", "date"],
                ["tenureEndDate", "Tenure End Date", "date"],
                ["finalAmountAgreed", "Final Amount Agreed (₹)", "number"],
                ["amountDeposited", "Amount Deposited (₹)", "number"],
                ["aadhaar", "Aadhaar Number", "text"],
                ["pan", "PAN Number", "text"],
                ["currentAddress", "Current Address", "text"],
                ["permanentAddress", "Permanent Address", "text"],
                ["bankAccountName", "Bank Account Name", "text"],
                ["bankAccountNumber", "Account Number", "text"],
                ["bankIfsc", "IFSC Code", "text"],
                ["bankName", "Bank Name", "text"],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) => f(key, e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder={label}
                  />
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Operational Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => f("notes", e.target.value)}
                rows={2}
                placeholder="Special territorial covenants, deposit terms, or operational instructions"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={createMut.isPending || !form.name || !form.phone}
                className="bg-primary text-primary-foreground text-xs"
              >
                {createMut.isPending ? "Registering Partner…" : "Save Franchisee Record"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Franchisee list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading franchise partners…</div>
          ) : franchisees.length === 0 ? (
            <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">
              No franchise partners registered yet.
            </div>
          ) : (
            franchisees.map((fr: any) => (
              <div key={fr.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-amber-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{fr.name}</p>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full capitalize border font-medium ${
                          statusBadge[fr.status] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {fr.status}
                      </span>
                      {fr.userId ? (
                        <span className="text-xs bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full">
                          App Login Active
                        </span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          No Login
                        </span>
                      )}
                    </div>

                    <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      {fr.cityName && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <MapPin size={11} className="text-primary" />
                          {fr.cityName}
                        </span>
                      )}
                      {fr.branchName && <span>Branch: {fr.branchName}</span>}
                      {fr.agreementNumber && (
                        <span className="flex items-center gap-1">
                          <FileText size={10} />
                          {fr.agreementNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {fr.phone}
                      </span>
                      {fr.commissionPercentage && (
                        <span className="flex items-center gap-1 text-primary">
                          <Percent size={10} />
                          {fr.commissionPercentage}% Commission
                        </span>
                      )}
                      <span>{fr.staffCount ?? 0} Staff</span>
                      <span>{fr.activeSubscriptionsCount ?? 0} Subscriptions</span>
                    </div>

                    {fr.status === "suspended" && fr.suspensionReason && (
                      <div className="mt-2 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-md p-2 flex items-center gap-2">
                        <ShieldAlert size={14} className="flex-shrink-0" />
                        <span>
                          <strong>Suspended:</strong> {fr.suspensionReason}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center">
                    <div className="text-right mr-1">
                      <p className="font-bold text-sm text-primary">
                        ₹{Number(fr.finalAmountAgreed || 0).toLocaleString("en-IN")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Agreed · ₹{Number(fr.amountDeposited || 0).toLocaleString("en-IN")} dep.
                      </p>
                    </div>

                    {!fr.userId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          setAccountModal({ id: fr.id, name: fr.name, isReset: false });
                          setNewPassword("");
                        }}
                      >
                        <Key size={12} className="mr-1" />
                        Create Login
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setAccountModal({ id: fr.id, name: fr.name, isReset: true });
                          setNewPassword("");
                        }}
                        title="Reset Partner Password"
                      >
                        <RotateCcw size={12} className="mr-1" />
                        Reset
                      </Button>
                    )}

                    <button
                      onClick={() => setExpanded(expanded === fr.id ? null : fr.id)}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50"
                    >
                      {expanded === fr.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {expanded === fr.id && (
                  <div className="border-t border-border px-5 py-4 bg-muted/20 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                      {[
                        ["Legal Entity", fr.legalEntityName || "—"],
                        ["Agreement No.", fr.agreementNumber || "—"],
                        ["Commission Rate", fr.commissionPercentage ? `${fr.commissionPercentage}%` : "—"],
                        ["Aadhaar", fr.aadhaar],
                        ["PAN", fr.pan],
                        ["Tenure Start", fr.tenureStartDate],
                        ["Tenure End", fr.tenureEndDate],
                        ["Amount Agreed", fr.finalAmountAgreed ? `₹${Number(fr.finalAmountAgreed).toLocaleString("en-IN")}` : "—"],
                        ["Deposited", fr.amountDeposited ? `₹${Number(fr.amountDeposited).toLocaleString("en-IN")}` : "—"],
                        ["Due Amount", fr.dueAmount ? `₹${Number(fr.dueAmount).toLocaleString("en-IN")}` : "—"],
                        ["Bank", fr.bankName],
                        ["Account", fr.bankAccountNumber],
                        ["IFSC", fr.bankIfsc],
                        ["Current Address", fr.currentAddress],
                        ["Permanent Address", fr.permanentAddress],
                        ["Secondary Phone", fr.secondaryPhone],
                      ].map(([label, val]) =>
                        val ? (
                          <div key={label as string}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="font-medium text-sm mt-0.5">{val}</p>
                          </div>
                        ) : null
                      )}
                    </div>

                    {fr.notes && <p className="text-xs text-muted-foreground italic bg-background/50 p-2.5 rounded-lg border border-border">{fr.notes}</p>}

                    <div className="flex gap-2 flex-wrap items-center pt-2">
                      {fr.status !== "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-500 border-green-500/30 hover:bg-green-500/10 text-xs"
                          onClick={() => activateMut.mutate(fr.id)}
                          disabled={activateMut.isPending}
                        >
                          <CheckCircle size={12} className="mr-1" />
                          Activate Franchise
                        </Button>
                      )}

                      {fr.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-500 border-rose-500/30 hover:bg-rose-500/10 text-xs"
                          onClick={() => {
                            setSuspendModal({ id: fr.id, name: fr.name });
                            setSuspendReason("");
                          }}
                        >
                          <ShieldAlert size={12} className="mr-1" />
                          Suspend Franchise
                        </Button>
                      )}

                      {fr.status !== "inactive" && fr.status !== "suspended" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-500 border-amber-500/30 text-xs"
                          onClick={() => statusMut.mutate({ id: fr.id, status: "inactive" })}
                        >
                          Set Inactive
                        </Button>
                      )}

                      {fr.status !== "terminated" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 border-red-400/30 text-xs"
                          onClick={() => {
                            if (confirm(`Terminate franchise agreement for ${fr.name}? This action is irreversible.`)) {
                              statusMut.mutate({ id: fr.id, status: "terminated" });
                            }
                          }}
                        >
                          Terminate Agreement
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Suspend Franchise Modal */}
        {suspendModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center gap-2 text-rose-500 mb-2">
                <AlertTriangle size={20} />
                <h3 className="font-display font-bold text-lg">Suspend Franchise Partner</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Suspending <strong>{suspendModal.name}</strong> will revoke login sessions for the partner, freeze
                operations, and place their linked branch on suspension hold.
              </p>
              <label className="text-xs font-medium text-foreground mb-1 block">Mandatory Audit Reason *</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                placeholder="e.g. Contractual audit failure, quality breach, or royalty arrears"
                className="w-full bg-background border border-border rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setSuspendModal(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={!suspendReason.trim() || suspendMut.isPending}
                  onClick={() => suspendMut.mutate({ id: suspendModal.id, reason: suspendReason.trim() })}
                >
                  {suspendMut.isPending ? "Suspending…" : "Confirm Suspension"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Account creation / Password Reset modal */}
        {accountModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="font-display font-bold text-lg mb-1">
                {accountModal.isReset ? "Reset Partner Password" : "Create Franchise Login"}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">For {accountModal.name}</p>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {accountModal.isReset ? "Enter New Password" : "Set Password"}
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                containerClassName="mb-4"
                placeholder="Enter secure password (min 6 chars)"
              />
              <div className="flex gap-2">
                <Button
                  className="bg-primary text-primary-foreground flex-1 text-xs"
                  disabled={newPassword.length < 6 || accountMut.isPending}
                  onClick={() =>
                    accountMut.mutate({
                      id: accountModal.id,
                      password: newPassword,
                      isReset: accountModal.isReset,
                    })
                  }
                >
                  {accountMut.isPending
                    ? "Updating…"
                    : accountModal.isReset
                    ? "Reset Password"
                    : "Create Account"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAccountModal(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
