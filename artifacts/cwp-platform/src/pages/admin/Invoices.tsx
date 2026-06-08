import { useState } from "react";
import { useListInvoices, getListInvoicesQueryKey, useListPayments, getListPaymentsQueryKey, useRecordPayment } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle } from "lucide-react";

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-muted",
  cancelled: "bg-muted text-muted-foreground border-muted",
};

export default function AdminInvoices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ customerId: "", invoiceId: "", amount: "", method: "upi" });

  const { data: invoices, isLoading } = useListInvoices({}, { query: { queryKey: getListInvoicesQueryKey({}) } });
  const { data: payments } = useListPayments({}, { query: { queryKey: getListPaymentsQueryKey({}) } });

  const payMutation = useRecordPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        qc.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        setPayOpen(false);
        toast({ title: "Payment recorded" });
      },
      onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
    },
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Invoices & Payments</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{invoices?.total ?? 0} invoices</p>
          </div>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-record-payment">
                <PlusCircle size={15} className="mr-1.5" />Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                {[["customerId", "Customer ID", "number"], ["invoiceId", "Invoice ID (optional)", "number"], ["amount", "Amount (₹)", "number"]].map(([k, l, t]) => (
                  <div key={k}>
                    <Label>{l}</Label>
                    <Input data-testid={`input-pay-${k}`} type={t} value={(payForm as any)[k]} onChange={e => setPayForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1" />
                  </div>
                ))}
                <div>
                  <Label>Method</Label>
                  <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["cash", "upi", "card", "bank_transfer", "razorpay"].map(m => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => payMutation.mutate({ data: { ...payForm, customerId: parseInt(payForm.customerId), invoiceId: payForm.invoiceId ? parseInt(payForm.invoiceId) : undefined, amount: parseFloat(payForm.amount) } as any })}
                  disabled={payMutation.isPending} className="w-full bg-primary text-secondary hover:bg-primary/90" data-testid="btn-submit-payment">
                  {payMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>{["Invoice #", "Customer", "Total", "Paid", "Due", "Status", "Due Date"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>) :
                    (invoices?.data ?? []).map(inv => (
                      <tr key={inv.id} className="hover:bg-muted/20" data-testid={`invoice-row-${inv.id}`}>
                        <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 font-medium">{inv.customerName}</td>
                        <td className="px-4 py-3">₹{Number(inv.totalAmount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-green-600">₹{Number(inv.paidAmount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3">
                          {Number(inv.dueAmount) > 0 ? <span className="text-destructive font-medium">₹{Number(inv.dueAmount).toLocaleString("en-IN")}</span> : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${statusColors[inv.status ?? "draft"]}`}>{inv.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{inv.dueDate ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!isLoading && (invoices?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No invoices found</div>}
            </div>
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>{["Customer", "Amount", "Method", "Transaction ID", "Date"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(payments?.data ?? []).map(p => (
                    <tr key={p.id} className="hover:bg-muted/20" data-testid={`payment-row-${p.id}`}>
                      <td className="px-4 py-3 font-medium">{p.customerName}</td>
                      <td className="px-4 py-3 font-semibold text-primary">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 uppercase text-xs text-muted-foreground">{p.method}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.transactionId ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.createdAt!).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(payments?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No payments found</div>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
