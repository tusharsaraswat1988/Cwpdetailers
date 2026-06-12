import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserX, Send, Check, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

async function fetchChurned() {
  const res = await fetch("/api/churned");
  return res.json();
}
async function sendBulkMessage(payload: { subscriptionIds: number[]; message: string }) {
  const res = await fetch("/api/churned/bulk-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}
async function updateRemark(id: number, remark: string) {
  const res = await fetch(`/api/churned/${id}/remark`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remark }),
  });
  return res.json();
}

export default function AdminChurnedCustomers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: churned = [], isLoading } = useQuery({ queryKey: ["churned"], queryFn: fetchChurned });

  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("Hi {name}, we miss you at CWP Detailers! 🚗 Come back and get 10% off your next subscription renewal. Reply YES to know more. — Team CWP");
  const [showCompose, setShowCompose] = useState(false);
  const [editRemark, setEditRemark] = useState<{ id: number; text: string } | null>(null);

  const bulkMut = useMutation({
    mutationFn: sendBulkMessage,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["churned"] });
      toast({ title: `Sent to ${data.dispatched} customers`, description: "Re-engagement messages dispatched." });
      setSelected([]); setShowCompose(false);
    },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  const remarkMut = useMutation({
    mutationFn: ({ id, remark }: { id: number; remark: string }) => updateRemark(id, remark),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["churned"] }); setEditRemark(null); toast({ title: "Remark saved" }); },
  });

  const toggle = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = () =>
    setSelected(selected.length === churned.length ? [] : churned.map((c: any) => c.id));

  const byCity = (churned as any[]).reduce((acc: Record<string, number>, c) => {
    const city = c.customerCity || "Unknown";
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Churned Customers</h1>
            <p className="text-muted-foreground text-sm mt-1">Cancelled subscriptions — select to send bulk re-engagement messages</p>
          </div>
          {selected.length > 0 && (
            <Button onClick={() => setShowCompose(true)} className="bg-primary text-secondary">
              <Send size={14} className="mr-2" />Message {selected.length} selected
            </Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="font-bold text-2xl text-red-400">{churned.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Churned</p>
          </div>
          {Object.entries(byCity).slice(0, 3).map(([city, count]) => (
            <div key={city} className="bg-card border border-border rounded-xl p-4">
              <p className="font-bold text-2xl text-primary">{count as number}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{city}</p>
            </div>
          ))}
        </div>

        {/* Message composer */}
        {showCompose && (
          <div className="bg-card border border-border rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={16} className="text-primary" />
              <h3 className="font-semibold text-sm">Compose Re-engagement Message</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Use <code className="bg-muted px-1 rounded">{"{name}"}</code> to personalize the message</p>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 mb-3" />
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground mb-3">
              <p className="font-medium text-foreground mb-1">Preview (for first recipient):</p>
              <p>{message.replace("{name}", (churned as any[])[selected[0] - 1]?.customerName || "Customer")}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => bulkMut.mutate({ subscriptionIds: selected, message })}
                disabled={bulkMut.isPending || !message.trim()} className="bg-primary text-secondary">
                <Send size={13} className="mr-1.5" />
                {bulkMut.isPending ? "Sending…" : `Send to ${selected.length} customers`}
              </Button>
              <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Select all bar */}
        {churned.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <button onClick={selectAll}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all ${
                selected.length === churned.length ? "bg-primary text-secondary border-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              <Check size={12} />{selected.length === churned.length ? "Deselect all" : `Select all (${churned.length})`}
            </button>
            {selected.length > 0 && <span className="text-xs text-muted-foreground">{selected.length} selected · </span>}
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : churned.length === 0 ? (
              <div className="py-12 text-center">
                <UserX size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No churned customers — excellent retention!</p>
              </div>
            ) : (
              (churned as any[]).map(c => (
                <div key={c.id}
                  className={`px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors ${selected.includes(c.id) ? "bg-primary/5" : "hover:bg-muted/20"}`}
                  onClick={() => toggle(c.id)}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${selected.includes(c.id) ? "bg-primary border-primary" : "border-border"}`}>
                    {selected.includes(c.id) && <Check size={11} className="text-secondary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{c.customerName}</p>
                      {c.messageSentAt && <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">Messaged</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Phone size={9} />{c.customerPhone}</span>
                      {c.customerCity && <span>{c.customerCity}</span>}
                      <span className="capitalize">{c.type?.replace("_", " ")}</span>
                      {c.cancelledAt && <span>Left: {new Date(c.cancelledAt).toLocaleDateString("en-IN")}</span>}
                    </div>
                    {editRemark && editRemark.id === c.id ? (
                      <div className="mt-2 flex gap-2" onClick={e => e.stopPropagation()}>
                        <input value={editRemark.text} onChange={e => setEditRemark({ id: c.id, text: e.target.value })}
                          className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                          placeholder="Add a remark..." />
                        <Button size="sm" className="h-6 text-xs bg-primary text-secondary" onClick={() => remarkMut.mutate({ id: c.id, remark: editRemark!.text })}>Save</Button>
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setEditRemark(null)}>×</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        {c.cancellationRemark && <p className="text-xs text-muted-foreground italic">"{c.cancellationRemark}"</p>}
                        <button className="text-xs text-primary hover:underline" onClick={e => { e.stopPropagation(); setEditRemark({ id: c.id, text: c.cancellationRemark || "" }); }}>
                          {c.cancellationRemark ? "Edit remark" : "+ Add remark"}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">₹{Number(c.price).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">was paying</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
