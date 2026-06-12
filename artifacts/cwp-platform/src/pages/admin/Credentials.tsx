import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, UserCog, Building2, Users, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

async function fetchStaff() {
  const res = await fetch("/api/staff?verificationStatus=verified");
  return res.json();
}
async function fetchFranchisees() {
  const res = await fetch("/api/franchisees");
  return res.json();
}
async function createStaffAccount(id: number, password: string) {
  const res = await fetch(`/api/staff/${id}/create-account`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
  return res.json();
}
async function createFranchiseeAccount(id: number, password: string) {
  const res = await fetch(`/api/franchisees/${id}/create-account`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
  return res.json();
}

type Tab = "staff" | "franchisee";

export default function AdminCredentials() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("staff");
  const [modal, setModal] = useState<{ type: Tab; id: number; name: string; phone: string } | null>(null);
  const [password, setPassword] = useState("");

  const { data: staff = [] } = useQuery({ queryKey: ["verified-staff"], queryFn: fetchStaff });
  const { data: franchisees = [] } = useQuery({ queryKey: ["franchisees-cred"], queryFn: fetchFranchisees });

  const staffMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => createStaffAccount(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["verified-staff"] });
      toast({ title: "Staff login created", description: `Phone: ${data.phone}` });
      setModal(null); setPassword("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const franchiseeMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => createFranchiseeAccount(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["franchisees-cred"] });
      toast({ title: "Franchisee login created", description: `Phone: ${data.phone}` });
      setModal(null); setPassword("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const items: any[] = tab === "staff"
    ? (staff as any[]).filter(s => s.verificationStatus === "verified")
    : franchisees;

  const isPending = staffMut.isPending || franchiseeMut.isPending;

  const handleCreate = () => {
    if (!modal) return;
    if (modal.type === "staff") staffMut.mutate({ id: modal.id, password });
    else franchiseeMut.mutate({ id: modal.id, password });
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl">Credential Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage login accounts for staff and franchisee holders</p>
        </div>

        {/* Info box */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-sm">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Account creation rules</p>
              <ul className="text-muted-foreground text-xs mt-1 space-y-1 list-disc list-inside">
                <li>Staff must be <strong>verified</strong> before getting a login account</li>
                <li>Franchisee accounts use their registered phone as username</li>
                <li>Each person can have only one account — set a strong password</li>
                <li>Share credentials securely with the person directly</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab("staff")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "staff" ? "bg-primary text-secondary" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            <UserCog size={14} />Staff
          </button>
          <button onClick={() => setTab("franchisee")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "franchisee" ? "bg-primary text-secondary" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            <Building2 size={14} />Franchisees
          </button>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">{tab === "staff" ? "Verified Staff" : "All Franchisees"}</span>
            <span className="text-xs text-muted-foreground">{items.length} records</span>
          </div>
          <div className="divide-y divide-border">
            {items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {tab === "staff" ? "No verified staff without accounts yet" : "No franchisees found"}
              </div>
            ) : (
              items.map((item: any) => (
                <div key={item.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-full ${tab === "staff" ? "bg-primary/10" : "bg-amber-500/10"} flex items-center justify-center flex-shrink-0`}>
                    <span className={`font-bold text-sm ${tab === "staff" ? "text-primary" : "text-amber-500"}`}>{item.name?.[0] ?? "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{item.phone}</span>
                      {item.email && <span>{item.email}</span>}
                      {tab === "staff" && item.role && <span className="capitalize">{item.role.replace("_", " ")}</span>}
                      {tab === "franchisee" && item.branchName && <span>{item.branchName}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {item.userId ? (
                      <div className="flex items-center gap-1.5 text-green-500 text-xs font-medium">
                        <CheckCircle size={13} />Account Active
                      </div>
                    ) : (
                      <Button size="sm" className="bg-primary text-secondary" onClick={() => { setModal({ type: tab, id: item.id, name: item.name, phone: item.phone }); setPassword(""); }}>
                        <Key size={12} className="mr-1.5" />Create Login
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base">Create Login</h3>
                <p className="text-muted-foreground text-xs">{modal.name} · {modal.phone}</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground mb-4">
              <p><strong>Username:</strong> {modal.phone} (phone number)</p>
              <p><strong>Role:</strong> {modal.type === "staff" ? "Staff" : "Franchisee"}</p>
            </div>
            <label className="text-xs text-muted-foreground mb-1 block">Set Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Enter a secure password (min 6 chars)"
              onKeyDown={e => e.key === "Enter" && password.length >= 6 && handleCreate()} />
            <div className="flex gap-2">
              <Button className="bg-primary text-secondary flex-1" disabled={password.length < 6 || isPending} onClick={handleCreate}>
                {isPending ? "Creating…" : "Create Account"}
              </Button>
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
