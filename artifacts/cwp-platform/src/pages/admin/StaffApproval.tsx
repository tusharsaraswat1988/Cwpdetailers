import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCog, CheckCircle, XCircle, Clock, Eye, Key, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

async function fetchStaff(status?: string) {
  const url = status ? `/api/staff?verificationStatus=${status}` : "/api/staff";
  const res = await fetch(url);
  return res.json();
}
async function verifyStaff(id: number, action: string, notes?: string) {
  const res = await fetch(`/api/staff/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, notes }),
  });
  return res.json();
}
async function createStaffAccount(id: number, password: string) {
  const res = await fetch(`/api/staff/${id}/create-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.json();
}

const verificationBadge: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-500", icon: Clock },
  verified: { label: "Verified", cls: "bg-green-500/10 text-green-500", icon: CheckCircle },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-400", icon: XCircle },
};

export default function AdminStaffApproval() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("pending");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [accountModal, setAccountModal] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff-approval", filter],
    queryFn: () => fetchStaff(filter || undefined),
  });

  const verifyMut = useMutation({
    mutationFn: ({ id, action, notes }: { id: number; action: string; notes?: string }) => verifyStaff(id, action, notes),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["staff-approval"] });
      toast({ title: vars.action === "verified" ? "Staff verified ✓" : "Staff rejected" });
      setNoteFor(null); setNoteText("");
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const accountMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => createStaffAccount(id, password),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["staff-approval"] });
      toast({ title: "Account created", description: `Login: ${data.phone}` });
      setAccountModal(null); setNewPassword("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message ?? "Error", variant: "destructive" }),
  });

  const pending = (staff as any[]).filter(s => s.verificationStatus === "pending").length;

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Staff Verification</h1>
            <p className="text-muted-foreground text-sm mt-1">Review staff documents and approve before they can take bookings</p>
          </div>
          {pending > 0 && (
            <span className="bg-amber-500/10 text-amber-500 text-sm font-medium px-3 py-1.5 rounded-full">{pending} awaiting review</span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {[["pending", "Pending"], ["verified", "Verified"], ["rejected", "Rejected"], ["", "All"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === val ? "bg-primary text-secondary" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
          ) : staff.length === 0 ? (
            <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">No staff in this category</div>
          ) : (
            (staff as any[]).map(s => {
              const badge = verificationBadge[s.verificationStatus] ?? verificationBadge.pending;
              const BadgeIcon = badge.icon;
              return (
                <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold">{s.name?.[0] ?? "?"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{s.name}</p>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                          <BadgeIcon size={10} />{badge.label}
                        </span>
                        {s.userId && <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">Has Login</span>}
                      </div>
                      <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="capitalize">{s.role?.replace("_", " ")}</span>
                        <span>{s.phone}</span>
                        {s.branchName && <span>{s.branchName}</span>}
                        {s.verifiedAt && <span>Verified {new Date(s.verifiedAt).toLocaleDateString("en-IN")}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {s.verificationStatus === "verified" && !s.userId && (
                        <Button size="sm" variant="outline" onClick={() => { setAccountModal({ id: s.id, name: s.name }); setNewPassword(""); }}>
                          <Key size={12} className="mr-1" />Create Login
                        </Button>
                      )}
                      <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="text-muted-foreground hover:text-foreground p-1">
                        {expanded === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {expanded === s.id && (
                    <div className="border-t border-border px-5 py-4 bg-muted/20">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                        {[
                          ["Aadhaar", s.aadhaar], ["PAN", s.pan],
                          ["Local Address", s.localAddress], ["Permanent Address", s.permanentAddress],
                          ["Guardian", s.guardianName], ["Guardian Phone", s.guardianPhone],
                          ["Email", s.email], ["Bank", s.bankAccountName],
                          ["Account No", s.bankAccountNumber], ["IFSC", s.bankIfsc],
                          ["Joining Date", s.joiningDate], ["Salary", s.monthlySalary ? `₹${Number(s.monthlySalary).toLocaleString("en-IN")}/mo` : null],
                        ].map(([label, val]) => val ? (
                          <div key={label as string}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="font-medium text-sm mt-0.5">{val}</p>
                          </div>
                        ) : null)}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.bankPassbookUrl && <a href={s.bankPassbookUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View Bank Passbook</a>}
                        {s.agreementUrl && <a href={s.agreementUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View Agreement</a>}
                      </div>

                      {s.verificationStatus === "pending" && (
                        <div className="mt-4">
                          {noteFor === s.id ? (
                            <div>
                              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Optional notes for staff/franchise..."
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 mb-2" />
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => verifyMut.mutate({ id: s.id, action: "verified", notes: noteText })}>
                                  <CheckCircle size={12} className="mr-1" />Verify
                                </Button>
                                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => verifyMut.mutate({ id: s.id, action: "rejected", notes: noteText })}>
                                  <XCircle size={12} className="mr-1" />Reject
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setNoteFor(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" className="bg-primary text-secondary" onClick={() => { setNoteFor(s.id); setNoteText(""); }}>
                              <Eye size={12} className="mr-1" />Review & Decide
                            </Button>
                          )}
                        </div>
                      )}
                      {s.verificationNotes && (
                        <p className="text-xs text-muted-foreground mt-3 italic">Note: {s.verificationNotes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Account modal */}
        {accountModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-display font-bold text-lg mb-1">Create Staff Login</h3>
              <p className="text-muted-foreground text-sm mb-4">For {accountModal.name}</p>
              <label className="text-xs text-muted-foreground mb-1 block">Set Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Secure password" />
              <div className="flex gap-2">
                <Button className="bg-primary text-secondary flex-1" disabled={!newPassword || accountMut.isPending}
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
