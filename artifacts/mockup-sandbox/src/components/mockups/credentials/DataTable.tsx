import { useState } from "react";
import { Key, UserCog, Building2, CheckCircle, Search, ArrowUpDown, Lock, X } from "lucide-react";

const staff = [
  { id: 1, name: "Ravi Kumar", phone: "9123456781", role: "technician", branch: "Varanasi", salary: 18000, joined: "2024-03-12", hasAccount: false },
  { id: 2, name: "Ankit Singh", phone: "9123456782", role: "supervisor", branch: "Varanasi", salary: 28000, joined: "2023-11-05", hasAccount: false },
  { id: 3, name: "Priya Patel", phone: "9123456783", role: "driver", branch: "Kanpur", salary: 16000, joined: "2024-06-01", hasAccount: false },
  { id: 4, name: "Suresh Yadav", phone: "9123456784", role: "technician", branch: "Varanasi", salary: 20000, joined: "2023-08-20", hasAccount: true },
  { id: 5, name: "Deepak Sharma", phone: "9123456785", role: "solar_technician", branch: "Lucknow", salary: 22000, joined: "2024-01-15", hasAccount: false },
];

const franchisees = [
  { id: 1, name: "Amit Gupta", phone: "9123456786", branch: "Varanasi", city: "Varanasi", hasAccount: false },
  { id: 2, name: "Neha Verma", phone: "9123456787", branch: "Kanpur", city: "Kanpur", hasAccount: true },
  { id: 3, name: "Vikram Joshi", phone: "9123456788", branch: "Lucknow", city: "Lucknow", hasAccount: false },
];

type Tab = "staff" | "franchisee";

export function DataTable() {
  const [tab, setTab] = useState<Tab>("staff");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<{ key: string; asc: boolean } | null>(null);
  const [modal, setModal] = useState<{ type: Tab; name: string; phone: string } | null>(null);
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  const rawItems = tab === "staff" ? staff : franchisees;
  let items = rawItems.filter(
    i => i.name.toLowerCase().includes(search.toLowerCase()) || i.phone.includes(search)
  );
  if (sortBy) {
    items = [...items].sort((a: any, b: any) => {
      const va = a[sortBy.key];
      const vb = b[sortBy.key];
      if (va < vb) return sortBy.asc ? -1 : 1;
      if (va > vb) return sortBy.asc ? 1 : -1;
      return 0;
    });
  }

  const handleCreate = () => {
    if (!modal || password.length < 6) return;
    setCreated(prev => [...prev, `${modal.type}-${modal.phone}`]);
    setModal(null);
    setPassword("");
  };

  const sortIcon = (key: string) => (
    <ArrowUpDown size={12} className={`ml-1 cursor-pointer ${sortBy?.key === key ? "text-[hsl(180,100%,40%)]" : "text-white/20"}`}
      onClick={() => setSortBy(prev => prev?.key === key ? { key, asc: !prev.asc } : { key, asc: true })} />
  );

  return (
    <div className="min-h-screen bg-[hsl(220,40%,6%)] text-white/90 p-8 font-['Plus_Jakarta_Sans']">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-['Outfit'] font-bold text-2xl">Credential Management</h1>
            <p className="text-white/40 text-sm mt-1">Create and manage login accounts for staff and franchisees</p>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-2 text-xs text-white/30 bg-[hsl(180,100%,40%)]/5 border border-[hsl(180,100%,40%)]/10 px-4 py-2.5 rounded-lg mb-5">
          <Lock size={12} className="text-[hsl(180,100%,40%)]" />
          <span>Staff must be <strong className="text-white/50">verified</strong> before getting a login account. Franchisee accounts use their registered phone as username.</span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-2">
            <button onClick={() => setTab("staff")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === "staff" ? "bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)]" : "bg-white/[0.02] border border-white/10 text-white/50 hover:text-white"}`}>
              <UserCog size={12} />Staff
              <span className="px-1.5 py-0.5 rounded bg-white/10">{staff.filter(s => !s.hasAccount).length}</span>
            </button>
            <button onClick={() => setTab("franchisee")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === "franchisee" ? "bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)]" : "bg-white/[0.02] border border-white/10 text-white/50 hover:text-white"}`}>
              <Building2 size={12} />Franchisees
              <span className="px-1.5 py-0.5 rounded bg-white/10">{franchisees.filter(f => !f.hasAccount).length}</span>
            </button>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="bg-white/[0.02] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[hsl(180,100%,40%)]/40 w-56" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/40 text-left">
                <th className="px-4 py-3 font-medium">Name {sortIcon("name")}</th>
                <th className="px-4 py-3 font-medium">Phone {sortIcon("phone")}</th>
                {tab === "staff" && <th className="px-4 py-3 font-medium">Role {sortIcon("role")}</th>}
                <th className="px-4 py-3 font-medium">Branch {sortIcon("branch")}</th>
                {tab === "staff" && <th className="px-4 py-3 font-medium">Salary {sortIcon("salary")}</th>}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={tab === "staff" ? 7 : 5} className="px-4 py-12 text-center text-white/30 text-sm">No matching records</td></tr>
              ) : (
                items.map(item => {
                  const key = `${tab}-${item.phone}`;
                  const isCreated = created.includes(key) || item.hasAccount;
                  return (
                    <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full ${tab === "staff" ? "bg-[hsl(180,100%,40%)]/10" : "bg-amber-500/10"} flex items-center justify-center flex-shrink-0`}>
                            <span className={`font-bold text-xs ${tab === "staff" ? "text-[hsl(180,100%,40%)]" : "text-amber-400"}`}>{item.name[0]}</span>
                          </div>
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/50">{item.phone}</td>
                      {tab === "staff" && <td className="px-4 py-3 text-white/50 capitalize">{(item as any).role.replace(/_/g, " ")}</td>}
                      <td className="px-4 py-3 text-white/50">{item.branch}</td>
                      {tab === "staff" && <td className="px-4 py-3 text-white/50">₹{(item as any).salary.toLocaleString("en-IN")}</td>}
                      <td className="px-4 py-3">
                        {isCreated ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            <CheckCircle size={12} />Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                            <X size={12} />No account
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isCreated ? (
                          <button onClick={() => { setModal({ type: tab, name: item.name, phone: item.phone }); setPassword(""); }}
                            className="flex items-center gap-1 text-xs font-medium bg-[hsl(180,100%,40%)] text-[hsl(220,40%,6%)] px-3 py-1.5 rounded-lg hover:bg-[hsl(180,100%,40%)]/80 transition-colors ml-auto">
                            <Key size={10} />Create
                          </button>
                        ) : (
                          <span className="text-xs text-white/20">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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

export default DataTable;
