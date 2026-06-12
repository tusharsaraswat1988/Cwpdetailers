import { useState } from "react";
import { Key, UserCog, Building2, CheckCircle, Lock, Search, X, Shield } from "lucide-react";

const staff = [
  { id: 1, name: "Ravi Kumar", phone: "9123456781", role: "technician", branch: "Varanasi", hasAccount: false },
  { id: 2, name: "Ankit Singh", phone: "9123456782", role: "supervisor", branch: "Varanasi", hasAccount: false },
  { id: 3, name: "Priya Patel", phone: "9123456783", role: "driver", branch: "Kanpur", hasAccount: false },
  { id: 4, name: "Suresh Yadav", phone: "9123456784", role: "technician", branch: "Varanasi", hasAccount: true },
  { id: 5, name: "Deepak Sharma", phone: "9123456785", role: "solar_technician", branch: "Lucknow", hasAccount: false },
];

const franchisees = [
  { id: 1, name: "Amit Gupta", phone: "9123456786", branch: "Varanasi", hasAccount: false },
  { id: 2, name: "Neha Verma", phone: "9123456787", branch: "Kanpur", hasAccount: true },
  { id: 3, name: "Vikram Joshi", phone: "9123456788", branch: "Lucknow", hasAccount: false },
];

type Tab = "staff" | "franchisee";

export function ListView() {
  const [tab, setTab] = useState<Tab>("staff");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ type: Tab; name: string; phone: string } | null>(null);
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  const items = (tab === "staff" ? staff : franchisees).filter(
    i => i.name.toLowerCase().includes(search.toLowerCase()) || i.phone.includes(search)
  );

  const handleCreate = () => {
    if (!modal || password.length < 6) return;
    setCreated(prev => [...prev, `${modal.type}-${modal.phone}`]);
    setModal(null);
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-[hsl(220,40%,6%)] text-white/90 p-8 font-['Plus_Jakarta_Sans']">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-['Outfit'] font-bold text-2xl">Credential Management</h1>
          <p className="text-white/40 text-sm mt-1">Create and manage login accounts for staff and franchisee holders</p>
        </div>

        {/* Info box */}
        <div className="bg-[hsl(180,100%,40%)]/5 border border-[hsl(180,100%,40%)]/20 rounded-xl p-4 mb-6 text-sm">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-[hsl(180,100%,40%)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Account creation rules</p>
              <ul className="text-white/40 text-xs mt-1 space-y-1 list-disc list-inside">
                <li>Staff must be <strong>verified</strong> before getting a login account</li>
                <li>Franchisee accounts use their registered phone as username</li>
                <li>Each person can have only one account — set a strong password</li>
                <li>Share credentials securely with the person directly</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex gap-2">
            <button onClick={() => setTab("staff")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "staff" ? "bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)]" : "bg-white/[0.02] border border-white/10 text-white/50 hover:text-white"}`}>
              <UserCog size={14} />Staff
              <span className="text-xs ml-1 px-1.5 py-0.5 rounded bg-white/10">{staff.filter(s => !s.hasAccount).length}</span>
            </button>
            <button onClick={() => setTab("franchisee")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "franchisee" ? "bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)]" : "bg-white/[0.02] border border-white/10 text-white/50 hover:text-white"}`}>
              <Building2 size={14} />Franchisees
              <span className="text-xs ml-1 px-1.5 py-0.5 rounded bg-white/10">{franchisees.filter(f => !f.hasAccount).length}</span>
            </button>
          </div>
          <div className="flex-1 flex justify-end">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..."
                className="bg-white/[0.02] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(180,100%,40%)]/40 w-64" />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold">{tab === "staff" ? "Verified Staff" : "All Franchisees"}</span>
            <span className="text-xs text-white/30">{items.length} records</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {items.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">No matching records found</div>
            ) : (
              items.map(item => {
                const key = `${tab}-${item.phone}`;
                const isCreated = created.includes(key) || item.hasAccount;
                return (
                  <div key={item.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                    <div className={`w-9 h-9 rounded-full ${tab === "staff" ? "bg-[hsl(180,100%,40%)]/10" : "bg-amber-500/10"} flex items-center justify-center flex-shrink-0`}>
                      <span className={`font-bold text-sm ${tab === "staff" ? "text-[hsl(180,100%,40%)]" : "text-amber-400"}`}>{item.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.name}</p>
                      <div className="flex gap-3 text-xs text-white/30 mt-0.5">
                        <span>{item.phone}</span>
                        <span>{item.branch}</span>
                        {tab === "staff" && (item as any).role && <span className="capitalize">{(item as any).role.replace(/_/g, " ")}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isCreated ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                          <CheckCircle size={13} />Account Active
                        </div>
                      ) : (
                        <button onClick={() => { setModal({ type: tab, name: item.name, phone: item.phone }); setPassword(""); }}
                          className="flex items-center gap-1.5 text-xs font-medium bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)] px-3 py-1.5 rounded-lg hover:bg-[hsl(180,100%,40%)]/80 transition-colors">
                          <Key size={12} />Create Login
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[hsl(220,40%,8%)] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(180,100%,40%)]/10 flex items-center justify-center">
                <Key size={18} className="text-[hsl(180,100%,40%)]" />
              </div>
              <div>
                <h3 className="font-['Outfit'] font-bold text-base">Create Login</h3>
                <p className="text-white/30 text-xs">{modal.name} · {modal.phone}</p>
              </div>
            </div>
            <div className="bg-white/[0.02] rounded-lg px-3 py-2 text-xs text-white/30 mb-4">
              <p><strong className="text-white/50">Username:</strong> {modal.phone} (phone number)</p>
              <p><strong className="text-white/50">Role:</strong> {modal.type === "staff" ? "Staff" : "Franchisee"}</p>
            </div>
            <label className="text-xs text-white/30 mb-1 block">Set Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(180,100%,40%)]/40"
              placeholder="Enter a secure password (min 6 chars)"
              onKeyDown={e => e.key === "Enter" && password.length >= 6 && handleCreate()} />
            <div className="flex gap-2">
              <button className="flex-1 bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)] px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                disabled={password.length < 6} onClick={handleCreate}>Create Account</button>
              <button className="px-4 py-2 rounded-lg text-sm border border-white/10 text-white/60 hover:text-white"
                onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListView;
