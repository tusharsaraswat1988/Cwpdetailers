import { useState } from "react";
import { Key, UserCog, Building2, CheckCircle, Shield, Star, Phone, MapPin, Lock } from "lucide-react";

const staff = [
  { id: 1, name: "Ravi Kumar", phone: "9123456781", role: "technician", branch: "Varanasi", rating: 4.5, hasAccount: false },
  { id: 2, name: "Ankit Singh", phone: "9123456782", role: "supervisor", branch: "Varanasi", rating: 4.8, hasAccount: false },
  { id: 3, name: "Priya Patel", phone: "9123456783", role: "driver", branch: "Kanpur", rating: 4.2, hasAccount: false },
  { id: 4, name: "Suresh Yadav", phone: "9123456784", role: "technician", branch: "Varanasi", rating: 4.7, hasAccount: true },
  { id: 5, name: "Deepak Sharma", phone: "9123456785", role: "solar_technician", branch: "Lucknow", rating: 4.3, hasAccount: false },
];

const franchisees = [
  { id: 1, name: "Amit Gupta", phone: "9123456786", branch: "Varanasi", hasAccount: false },
  { id: 2, name: "Neha Verma", phone: "9123456787", branch: "Kanpur", hasAccount: true },
  { id: 3, name: "Vikram Joshi", phone: "9123456788", branch: "Lucknow", hasAccount: false },
];

type Tab = "staff" | "franchisee";

export function CardGrid() {
  const [tab, setTab] = useState<Tab>("staff");
  const [modal, setModal] = useState<{ type: Tab; name: string; phone: string } | null>(null);
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  const items = tab === "staff" ? staff : franchisees;

  const handleCreate = () => {
    if (!modal || password.length < 6) return;
    setCreated(prev => [...prev, `${modal.type}-${modal.phone}`]);
    setModal(null);
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-[hsl(220,40%,6%)] text-white/90 p-8 font-['Plus_Jakarta_Sans']">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-['Outfit'] font-bold text-2xl">Credential Management</h1>
            <p className="text-white/40 text-sm mt-1">Create and manage login accounts for staff and franchisees</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30 bg-white/[0.02] border border-white/10 px-3 py-1.5 rounded-lg">
            <Lock size={12} />
            <span>Verified users only</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
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

        {/* Card Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const key = `${tab}-${item.phone}`;
            const isCreated = created.includes(key) || item.hasAccount;
            return (
              <div key={item.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 hover:border-[hsl(180,100%,40%)]/20 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full ${tab === "staff" ? "bg-[hsl(180,100%,40%)]/10" : "bg-amber-500/10"} flex items-center justify-center flex-shrink-0`}>
                    <span className={`font-bold text-sm ${tab === "staff" ? "text-[hsl(180,100%,40%)]" : "text-amber-400"}`}>{item.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.name}</p>
                    <div className="flex items-center gap-2 text-xs text-white/30 mt-0.5">
                      <span className="flex items-center gap-1"><Phone size={10} />{item.phone}</span>
                    </div>
                  </div>
                  {isCreated && (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs bg-emerald-400/10 px-2 py-1 rounded-lg">
                      <CheckCircle size={12} />Active
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-xs text-white/30 mb-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={10} className="text-white/20" />{item.branch}
                  </div>
                  {tab === "staff" && (
                    <div className="flex items-center gap-1.5">
                      <Shield size={10} className="text-white/20" />
                      <span className="capitalize">{(item as any).role.replace(/_/g, " ")}</span>
                      <span className="text-[hsl(180,100%,40%)] flex items-center gap-0.5 ml-1"><Star size={10} fill="currentColor" />{(item as any).rating}</span>
                    </div>
                  )}
                </div>

                {!isCreated && (
                  <button onClick={() => { setModal({ type: tab, name: item.name, phone: item.phone }); setPassword(""); }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)] px-3 py-2 rounded-lg hover:bg-[hsl(180,100%,40%)]/80 transition-colors">
                    <Key size={12} />Create Login Account
                  </button>
                )}
                {isCreated && (
                  <div className="w-full text-xs text-center text-white/20 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    Account already created
                  </div>
                )}
              </div>
            );
          })}
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
              <p><strong className="text-white/50">Username:</strong> {modal.phone}</p>
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

export default CardGrid;
