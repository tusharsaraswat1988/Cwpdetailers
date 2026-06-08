import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Phone, Mail, MapPin, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

async function fetchFranchisees() {
  const res = await fetch("/api/franchisees");
  return res.json();
}
async function createFranchisee(data: any) {
  const res = await fetch("/api/franchisees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return res.json();
}
async function updateFranchisee(id: number, data: any) {
  const res = await fetch(`/api/franchisees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return res.json();
}
async function createAccount(id: number, password: string) {
  const res = await fetch(`/api/franchisees/${id}/create-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
  return res.json();
}

const statusBadge: Record<string, string> = {
  active: "bg-green-500/10 text-green-500",
  pending: "bg-amber-500/10 text-amber-500",
  inactive: "bg-muted text-muted-foreground",
  terminated: "bg-red-500/10 text-red-400",
};

const emptyForm = {
  name: "", phone: "", email: "", secondaryPhone: "", branchId: "",
  currentAddress: "", permanentAddress: "", aadhaar: "", pan: "",
  tenureStartDate: "", tenureEndDate: "",
  finalAmountAgreed: "", amountDeposited: "",
  bankAccountName: "", bankAccountNumber: "", bankIfsc: "", bankName: "",
  notes: "",
};

export default function AdminFranchisees() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: franchisees = [], isLoading } = useQuery({ queryKey: ["franchisees"], queryFn: fetchFranchisees });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [accountModal, setAccountModal] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const createMut = useMutation({
    mutationFn: createFranchisee,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["franchisees"] }); setShowForm(false); setForm(emptyForm); toast({ title: "Franchisee added" }); },
    onError: () => toast({ title: "Failed to add franchisee", variant: "destructive" }),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateFranchisee(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["franchisees"] }); toast({ title: "Status updated" }); },
  });
  const accountMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => createAccount(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["franchisees"] });
      toast({ title: "Account created", description: `Phone: ${data.phone} · Password set` });
      setAccountModal(null); setNewPassword("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Franchisees</h1>
            <p className="text-muted-foreground text-sm mt-1">City franchise partners — owned locally, operated by CWP</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-primary text-secondary">
            <Plus size={14} className="mr-2" />Add Franchisee
          </Button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4">New Franchisee Record</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {[
                ["name", "Full Name *"], ["phone", "Mobile Number *"], ["email", "Email"],
                ["secondaryPhone", "Secondary Phone"], ["branchId", "Branch ID (City)"],
                ["currentAddress", "Current Address"], ["permanentAddress", "Permanent Address"],
                ["aadhaar", "Aadhaar Number"], ["pan", "PAN Number"],
                ["tenureStartDate", "Tenure Start Date"], ["tenureEndDate", "Tenure End Date"],
                ["finalAmountAgreed", "Final Amount Agreed (₹)"], ["amountDeposited", "Amount Deposited (₹)"],
                ["bankAccountName", "Bank Account Name"], ["bankAccountNumber", "Account Number"],
                ["bankIfsc", "IFSC Code"], ["bankName", "Bank Name"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                  <input
                    type={key.includes("Date") ? "date" : key.includes("Amount") || key === "branchId" ? "number" : "text"}
                    value={(form as any)[key]}
                    onChange={e => f(key, e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder={label.replace(" *", "")}
                  />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name || !form.phone} className="bg-primary text-secondary">
                {createMut.isPending ? "Saving…" : "Save Franchisee"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Franchisee list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
          ) : franchisees.length === 0 ? (
            <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">No franchisees yet</div>
          ) : (
            franchisees.map((fr: any) => (
              <div key={fr.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{fr.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusBadge[fr.status] || "bg-muted text-muted-foreground"}`}>{fr.status}</span>
                      {fr.userId && <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">Has Login</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {fr.branchName && <span className="flex items-center gap-1"><MapPin size={9} />{fr.branchName}</span>}
                      <span className="flex items-center gap-1"><Phone size={9} />{fr.phone}</span>
                      {fr.email && <span className="flex items-center gap-1"><Mail size={9} />{fr.email}</span>}
                      <span>{fr.staffCount ?? 0} staff</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right mr-2">
                      <p className="font-bold text-sm text-primary">₹{Number(fr.finalAmountAgreed || 0).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">Agreed</p>
                    </div>
                    {!fr.userId && (
                      <Button size="sm" variant="outline" onClick={() => { setAccountModal({ id: fr.id, name: fr.name }); setNewPassword(""); }}>
                        <Key size={12} className="mr-1" />Create Login
                      </Button>
                    )}
                    <button onClick={() => setExpanded(expanded === fr.id ? null : fr.id)} className="text-muted-foreground hover:text-foreground p-1">
                      {expanded === fr.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {expanded === fr.id && (
                  <div className="border-t border-border px-5 py-4 bg-muted/20">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm mb-4">
                      {[
                        ["Aadhaar", fr.aadhaar], ["PAN", fr.pan],
                        ["Tenure Start", fr.tenureStartDate], ["Tenure End", fr.tenureEndDate],
                        ["Amount Agreed", fr.finalAmountAgreed ? `₹${Number(fr.finalAmountAgreed).toLocaleString("en-IN")}` : "—"],
                        ["Deposited", fr.amountDeposited ? `₹${Number(fr.amountDeposited).toLocaleString("en-IN")}` : "—"],
                        ["Due", fr.dueAmount ? `₹${Number(fr.dueAmount).toLocaleString("en-IN")}` : "—"],
                        ["Bank", fr.bankName], ["Account", fr.bankAccountNumber], ["IFSC", fr.bankIfsc],
                        ["Current Address", fr.currentAddress], ["Permanent Address", fr.permanentAddress],
                        ["Secondary Phone", fr.secondaryPhone],
                      ].map(([label, val]) => val ? (
                        <div key={label as string}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-medium text-sm mt-0.5">{val}</p>
                        </div>
                      ) : null)}
                    </div>
                    {fr.notes && <p className="text-xs text-muted-foreground mb-3 italic">{fr.notes}</p>}
                    <div className="flex gap-2 flex-wrap">
                      {fr.status !== "active" && (
                        <Button size="sm" variant="outline" className="text-green-500 border-green-500/30"
                          onClick={() => statusMut.mutate({ id: fr.id, status: "active" })}>Activate</Button>
                      )}
                      {fr.status === "active" && (
                        <Button size="sm" variant="outline" className="text-amber-500 border-amber-500/30"
                          onClick={() => statusMut.mutate({ id: fr.id, status: "inactive" })}>Deactivate</Button>
                      )}
                      <Button size="sm" variant="outline" className="text-red-400 border-red-400/30"
                        onClick={() => statusMut.mutate({ id: fr.id, status: "terminated" })}>Terminate</Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Account creation modal */}
        {accountModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-display font-bold text-lg mb-1">Create Login</h3>
              <p className="text-muted-foreground text-sm mb-4">For {accountModal.name}</p>
              <label className="text-xs text-muted-foreground mb-1 block">Set Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Enter a secure password" />
              <div className="flex gap-2">
                <Button className="bg-primary text-secondary flex-1"
                  disabled={!newPassword || accountMut.isPending}
                  onClick={() => accountMut.mutate({ id: accountModal.id, password: newPassword })}>
                  {accountMut.isPending ? "Creating…" : "Create Account"}
                </Button>
                <Button variant="outline" onClick={() => setAccountModal(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
