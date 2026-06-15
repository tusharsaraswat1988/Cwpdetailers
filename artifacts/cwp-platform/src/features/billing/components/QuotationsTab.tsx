import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle } from "lucide-react";
import { CreateQuotationDialog } from "./CreateQuotationDialog";

const qStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-muted",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  accepted: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  converted: "bg-primary/10 text-primary border-primary/20",
  expired: "bg-muted text-muted-foreground border-muted",
};

type QuotationFilter = "all" | "open" | "converted" | "expired";

async function fetchQuotations(params: Record<string, string>) {
  const url = new URL("/api/quotations", window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type Props = {
  customerId?: string;
  prefillCustomerId?: number;
};

export function QuotationsTab({ customerId, prefillCustomerId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<QuotationFilter>("all");
  const [convertingId, setConvertingId] = useState<number | null>(null);

  const queryParams: Record<string, string> = { limit: "50" };
  if (customerId) queryParams.customerId = customerId;
  if (filter === "converted") queryParams.status = "converted";
  else if (filter === "expired") queryParams.status = "expired";

  const { data: quotations, isLoading } = useQuery({
    queryKey: ["quotations", customerId, filter],
    queryFn: () => fetchQuotations(queryParams),
  });

  let rows = quotations?.data ?? [];
  if (filter === "open") {
    rows = rows.filter((q: { status?: string }) => ["draft", "sent", "accepted"].includes(q.status ?? ""));
  }

  const convert = async (id: number) => {
    setConvertingId(id);
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast({ title: "Quotation converted to invoice" });
      qc.invalidateQueries({ queryKey: ["quotations"] });
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
    } catch (err) {
      toast({
        title: "Convert failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setConvertingId(null);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: `Quotation marked ${status}` });
      qc.invalidateQueries({ queryKey: ["quotations"] });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const filters: { id: QuotationFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "converted", label: "Converted" },
    { id: "expired", label: "Expired" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? "default" : "outline"}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <PlusCircle size={15} className="mr-1.5" />Create Quotation
        </Button>
      </div>

      <CreateQuotationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialCustomerId={prefillCustomerId}
        onCreated={() => qc.invalidateQueries({ queryKey: ["quotations"] })}
      />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {["Quotation #", "Customer", "Subtotal", "GST", "Total", "Status", "Valid Until", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
              : rows.map((q: any) => (
                <tr key={q.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{q.quotationNumber}</td>
                  <td className="px-4 py-3 font-medium">{q.customerName}</td>
                  <td className="px-4 py-3">₹{Number(q.subtotal).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">₹{Number(q.gstAmount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold">₹{Number(q.totalAmount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${qStatusColors[q.status ?? "draft"]}`}>{q.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{q.validUntil ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {["draft", "sent", "accepted"].includes(q.status) && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          disabled={convertingId === q.id}
                          onClick={() => convert(q.id)}
                        >
                          {convertingId === q.id ? "Converting..." : "Convert"}
                        </button>
                      )}
                      {q.status === "draft" && (
                        <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => updateStatus(q.id, "sent")}>
                          Mark sent
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!isLoading && rows.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No quotations found</div>
        )}
      </div>
    </div>
  );
}
