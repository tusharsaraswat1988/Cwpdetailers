import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, UserCog, Building2, CheckCircle, Lock, RefreshCw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";

async function fetchStaff() {
  const res = await fetch("/api/staff?verificationStatus=verified");
  return res.json();
}
async function fetchFranchisees() {
  const res = await fetch("/api/franchisees");
  return res.json();
}
async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      return res.status === 404
        ? "API endpoint not found — restart the dev server (pnpm dev) and try again."
        : `Server error (${res.status})`;
    }
    return text.slice(0, 120) || `Request failed (${res.status})`;
  }
}
async function createStaffAccount(id: number, password: string) {
  const res = await fetch(`/api/staff/${id}/create-account`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}
async function resetStaffPassword(id: number, password: string) {
  const res = await fetch(`/api/staff/${id}/reset-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}
async function sendStaffTestJobAlert(id: number) {
  const res = await fetch(`/api/staff/${id}/test-job-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as { ok: boolean; message: string; sent?: number; inApp?: boolean; hints?: string[] };
}
async function createFranchiseeAccount(id: number, password: string) {
  const res = await fetch(`/api/franchisees/${id}/create-account`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}
async function resetFranchiseePassword(id: number, password: string) {
  const res = await fetch(`/api/franchisees/${id}/reset-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

type Tab = "staff" | "franchisee";
type ModalMode = "create" | "reset";
type ModalState = { type: Tab; mode: ModalMode; id: number; name: string; phone: string };

export default function AdminCredentials() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("staff");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [password, setPassword] = useState("");

  const { data: staff = [] } = useQuery({ queryKey: ["verified-staff"], queryFn: fetchStaff });
  const { data: franchisees = [] } = useQuery({ queryKey: ["franchisees-cred"], queryFn: fetchFranchisees });

  const staffCreateMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => createStaffAccount(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["verified-staff"] });
      toast({ title: "Staff login created", description: `Phone: ${data.phone}` });
      setModal(null); setPassword("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const staffResetMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => resetStaffPassword(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["verified-staff"] });
      toast({
        title: data.repaired ? "Login repaired" : "Password reset",
        description: `${data.phone} can sign in with the new password.`,
      });
      setModal(null); setPassword("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const staffTestAlertMut = useMutation({
    mutationFn: (id: number) => sendStaffTestJobAlert(id),
    onSuccess: (data) => {
      const hint = data.hints?.length ? ` ${data.hints[0]}` : "";
      toast({
        title: (data as { sent?: number; inApp?: boolean }).sent ? "Test alert sent" : "In-app alert saved",
        description: `${data.message}${hint}`,
      });
    },
    onError: (err: Error) => toast({ title: "Test alert failed", description: err.message, variant: "destructive" }),
  });
  const franchiseeCreateMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => createFranchiseeAccount(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["franchisees-cred"] });
      toast({ title: "Franchisee login created", description: `Phone: ${data.phone}` });
      setModal(null); setPassword("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const franchiseeResetMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => resetFranchiseePassword(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["franchisees-cred"] });
      toast({ title: "Password reset", description: `${data.phone} can sign in with the new password.` });
      setModal(null); setPassword("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const items: any[] = tab === "staff"
    ? (staff as any[]).filter(s => s.verificationStatus === "verified")
    : franchisees;

  const isPending = staffCreateMut.isPending || staffResetMut.isPending || staffTestAlertMut.isPending
    || franchiseeCreateMut.isPending || franchiseeResetMut.isPending;

  const openModal = (item: any, mode: ModalMode) => {
    setModal({ type: tab, mode, id: item.id, name: item.name, phone: item.phone });
    setPassword("");
  };

  const handleSubmit = () => {
    if (!modal) return;
    const payload = { id: modal.id, password };
    if (modal.type === "staff") {
      if (modal.mode === "create") staffCreateMut.mutate(payload);
      else staffResetMut.mutate(payload);
    } else {
      if (modal.mode === "create") franchiseeCreateMut.mutate(payload);
      else franchiseeResetMut.mutate(payload);
    }
  };

  const isReset = modal?.mode === "reset";

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl">Credential Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage login accounts for staff and franchisee holders</p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-sm">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Account creation rules</p>
              <ul className="text-muted-foreground text-xs mt-1 space-y-1 list-disc list-inside">
                <li>Staff must be <strong>verified</strong> before getting a login account</li>
                <li>Franchisee accounts use their registered phone as username</li>
                <li>Use <strong>Reset Password</strong> when someone forgets their login</li>
                <li><strong>Test job alert</strong> sends a sample vibration + notification to staff with an active login (no real job)</li>
                <li>Share credentials securely with the person directly</li>
              </ul>
            </div>
          </div>
        </div>

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
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {item.userId ? (
                      <>
                        <div className="flex items-center gap-1.5 text-green-500 text-xs font-medium">
                          <CheckCircle size={13} />Account Active
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openModal(item, "reset")}>
                          <RefreshCw size={12} className="mr-1.5" />Reset Password
                        </Button>
                        {tab === "staff" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={staffTestAlertMut.isPending}
                            onClick={() => staffTestAlertMut.mutate(item.id)}
                          >
                            <Bell size={12} className="mr-1.5" />Test Alert
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button size="sm" className="bg-primary text-secondary" onClick={() => openModal(item, "create")}>
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

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {isReset ? <RefreshCw size={18} className="text-primary" /> : <Key size={18} className="text-primary" />}
              </div>
              <div>
                <h3 className="font-display font-bold text-base">{isReset ? "Reset Password" : "Create Login"}</h3>
                <p className="text-muted-foreground text-xs">{modal.name} · {modal.phone}</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground mb-4">
              <p><strong>Username:</strong> {modal.phone} (phone number)</p>
              <p><strong>Role:</strong> {modal.type === "staff" ? "Staff" : "Franchisee"}</p>
              {isReset && (
                <p className="mt-1 text-amber-600 dark:text-amber-400">
                  Existing sessions will be signed out. Share the new password securely.
                </p>
              )}
            </div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {isReset ? "New Password" : "Set Password"}
            </label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mb-4"
              placeholder="Enter a secure password (min 6 chars)"
              autoFocus
              onKeyDown={e => e.key === "Enter" && password.length >= 6 && handleSubmit()}
            />
            <div className="flex gap-2">
              <Button className="bg-primary text-secondary flex-1" disabled={password.length < 6 || isPending} onClick={handleSubmit}>
                {isPending ? "Saving…" : isReset ? "Reset Password" : "Create Account"}
              </Button>
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
