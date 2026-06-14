import { useState } from "react";
import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserX, MessageSquare, Send, Check, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

async function fetchChurned(branchId?: string) {
  const url = branchId ? `/api/churned?branchId=${branchId}` : "/api/churned";
  const res = await fetch(url);
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

export default function FranchiseeChurned() {
  const { user } = useAuth();
  const branchId = user?.branchId?.toString();
  const { toast } = useToast();

  const { data: churned = [], isLoading, refetch } = useQuery({
    queryKey: ["churned", branchId],
    queryFn: () => fetchChurned(branchId),
  });

  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("Hi {name}, we miss you! 🚗 Come back to CWP Detailers and get 10% off your first renewal. Reply YES to know more.");
  const [showCompose, setShowCompose] = useState(false);

  const bulkMutation = useMutation({
    mutationFn: sendBulkMessage,
    onSuccess: (data) => {
      toast({ title: `Message sent to ${data.dispatched} customers`, description: "Re-engagement messages dispatched successfully." });
      setSelected([]);
      setShowCompose(false);
      refetch();
    },
    onError: () => toast({ title: "Failed to send messages", variant: "destructive" }),
  });

  const toggle = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = () =>
    setSelected(selected.length === churned.length ? [] : churned.map((c: any) => c.id));

  return (
    <FranchiseeLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">Churned Customers</h1>
            <p className="text-muted-foreground text-sm mt-1">Customers who cancelled their subscription — reach out to win them back</p>
          </div>
          {selected.length > 0 && (
            <Button onClick={() => setShowCompose(true)} className="bg-primary text-secondary">
              <Send size={14} className="mr-2" />Message {selected.length} selected
            </Button>
          )}
        </div>

        {/* Bulk message composer */}
        {showCompose && (
          <div className="bg-card border border-border rounded-xl p-5 mb-5">
            <h3 className="font-semibold text-sm mb-3">Compose Re-engagement Message</h3>
            <p className="text-xs text-muted-foreground mb-2">Use <code className="bg-muted px-1 rounded">{"{name}"}</code> to personalize</p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex gap-2 mt-3">
              <Button onClick={() => bulkMutation.mutate({ subscriptionIds: selected, message })}
                disabled={bulkMutation.isPending || !message.trim()}
                className="bg-primary text-secondary">
                <Send size={13} className="mr-1.5" />
                {bulkMutation.isPending ? "Sending…" : `Send to ${selected.length} customers`}
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
                selected.length === churned.length
                  ? "bg-primary text-secondary border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              <Check size={12} />{selected.length === churned.length ? "Deselect all" : `Select all (${churned.length})`}
            </button>
            {selected.length > 0 && (
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
            )}
          </div>
        )}

        {/* List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : churned.length === 0 ? (
              <div className="py-12 text-center">
                <UserX size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No churned customers — great retention!</p>
              </div>
            ) : (
              churned.map((c: any) => (
                <div key={c.id}
                  className={`px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors ${
                    selected.includes(c.id) ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                  onClick={() => toggle(c.id)}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    selected.includes(c.id) ? "bg-primary border-primary" : "border-border"
                  }`}>
                    {selected.includes(c.id) && <Check size={11} className="text-secondary" />}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-400 font-bold text-sm">{c.customerName?.[0] ?? "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.customerName}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{c.customerPhone}</span>
                      {c.customerCity && <span>· {c.customerCity}</span>}
                      <span>· {c.type?.replace("_", " ")}</span>
                      {c.cancelledAt && <span>· Left: {new Date(c.cancelledAt).toLocaleDateString("en-IN")}</span>}
                      {c.messageSentAt && <span className="text-green-500">· Messaged</span>}
                    </div>
                    {c.cancellationRemark && (
                      <p className="text-xs text-muted-foreground italic mt-1">"{c.cancellationRemark}"</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                    <p className="font-bold text-sm">₹{Number(c.price).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">was paying/mo</p>
                    {c.customerId && (
                      <Link href={`/franchisee/customers/${c.customerId}`} onClick={e => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <ExternalLink size={11} className="mr-1" />View customer
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </FranchiseeLayout>
  );
}
