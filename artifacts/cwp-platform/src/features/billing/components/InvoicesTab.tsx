import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, ArrowRightLeft } from "lucide-react";
import { Link } from "wouter";
import { CreateCreditNoteDialog } from "./CreateCreditNoteDialog";
import { InvoicePdfButton } from "./InvoicePdfButton";

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-muted",
  cancelled: "bg-muted text-muted-foreground border-muted",
};

type InvoiceFilter = "all" | "unpaid" | "overdue" | "paid" | "credit_notes";

type InvoiceRow = {
  id?: number;
  invoiceNumber?: string | null;
  documentType?: string;
  customerName?: string;
  totalAmount?: string | number;
  paidAmount?: string | number;
  balanceDue?: string | number;
  status?: string | null;
  dueDate?: string | null;
  quotationId?: number | null;
  contractRegistryId?: number | null;
  serviceLocationId?: number | null;
  assetId?: number | null;
  serviceLocationLabel?: string | null;
  assetLabel?: string | null;
  referenceInvoiceNumber?: string | null;
};

async function fetchInvoices(params: Record<string, string>) {
  const url = new URL("/api/invoices", window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type Props = {
  customerId?: string;
};

export function InvoicesTab({ customerId }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditInvoice, setCreditInvoice] = useState<InvoiceRow | null>(null);

  const queryParams: Record<string, string> = { limit: "50" };
  if (customerId) queryParams.customerId = customerId;
  if (filter === "paid") queryParams.status = "paid";
  else if (filter === "overdue") queryParams.status = "overdue";
  else if (filter === "unpaid") queryParams.hasBalance = "true";
  else if (filter === "credit_notes") queryParams.documentType = "credit_note";

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", customerId, filter],
    queryFn: () => fetchInvoices(queryParams),
  });

  const filters: { id: InvoiceFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unpaid", label: "Unpaid" },
    { id: "overdue", label: "Overdue" },
    { id: "paid", label: "Paid" },
    { id: "credit_notes", label: "Refund notes" },
  ];

  return (
    <div className="space-y-4">
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

      {creditInvoice && (
        <CreateCreditNoteDialog
          open={creditOpen}
          onOpenChange={setCreditOpen}
          invoice={{
            id: creditInvoice.id!,
            invoiceNumber: creditInvoice.invoiceNumber,
            balanceDue: creditInvoice.balanceDue,
            totalAmount: creditInvoice.totalAmount,
          }}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["invoices"] });
            setCreditInvoice(null);
          }}
        />
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {["Invoice #", "Customer", "Service", "Service address", "Vehicle", "Total", "Paid", "Balance", "Status", "Due", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={11} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
              : (invoices?.data ?? []).map((inv: InvoiceRow) => (
                <tr key={inv.id} className="hover:bg-muted/20" data-testid={`invoice-row-${inv.id}`}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">
                    {inv.invoiceNumber}
                    {inv.documentType === "credit_note" && (
                      <Badge variant="outline" className="ml-2 text-[10px] h-5">CN</Badge>
                    )}
                    {inv.referenceInvoiceNumber && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ref {inv.referenceInvoiceNumber}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{inv.customerName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {inv.contractRegistryId ? `#${inv.contractRegistryId}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {inv.serviceLocationLabel ?? (inv.serviceLocationId ? `#${inv.serviceLocationId}` : "—")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {inv.assetLabel ?? (inv.assetId ? `#${inv.assetId}` : "—")}
                  </td>
                  <td className="px-4 py-3">₹{Number(inv.totalAmount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-green-600">₹{Number(inv.paidAmount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    {Number(inv.balanceDue ?? 0) > 0
                      ? <span className="text-destructive font-medium">₹{Number(inv.balanceDue).toLocaleString("en-IN")}</span>
                      : <span className="text-green-600">₹{Number(inv.balanceDue).toLocaleString("en-IN")}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${statusColors[inv.status ?? "draft"]}`}>{inv.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{inv.dueDate ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <InvoicePdfButton invoiceId={inv.id!} invoiceNumber={inv.invoiceNumber}>
                        <FileDown size={12} />PDF
                      </InvoicePdfButton>
                      {inv.documentType !== "credit_note" && Number(inv.balanceDue ?? 0) > 0 && (
                        <button
                          type="button"
                          className="text-xs text-amber-700 hover:underline"
                          onClick={() => {
                            setCreditInvoice(inv);
                            setCreditOpen(true);
                          }}
                        >
                          Refund note
                        </button>
                      )}
                      {inv.quotationId && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ArrowRightLeft size={12} />From quote
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!isLoading && (invoices?.data ?? []).length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No invoices found</div>
        )}
      </div>
    </div>
  );
}
