import { useState } from "react";
import { useListInvoices, getListInvoicesQueryKey, useListPayments, getListPaymentsQueryKey, useRecordPayment } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, FileDown, FileText, ArrowRightLeft } from "lucide-react";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-muted",
  cancelled: "bg-muted text-muted-foreground border-muted",
};

const qStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-muted",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  accepted: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  converted: "bg-primary/10 text-primary border-primary/20",
  expired: "bg-muted text-muted-foreground border-muted",
};

// Manual fetch helpers for new endpoints not yet in generated spec
async function createInvoice(body: Record<string, unknown>) {
  const res = await fetch("/api/invoices", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to create invoice");
  }
  return res.json();
}

async function fetchQuotations(params?: Record<string, string>) {
  const url = new URL("/api/quotations", window.location.origin);
  Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function fetchExpenses(params?: Record<string, string>) {
  const url = new URL("/api/expenses", window.location.origin);
  Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function AdminInvoices() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [invCustomer, setInvCustomer] = useState<CustomerSearchValue | null>(null);
  const [payCustomer, setPayCustomer] = useState<CustomerSearchValue | null>(null);
  const [payForm, setPayForm] = useState({ invoiceId: "", amount: "", method: "upi" });
  const [invForm, setInvForm] = useState({
    description: "",
    amount: "",
    subscriptionId: "",
    invoiceType: "package",
  });

  const { data: invoices, isLoading } = useListInvoices({}, { query: { queryKey: getListInvoicesQueryKey({}) } });
  const { data: payments } = useListPayments({}, { query: { queryKey: getListPaymentsQueryKey({}) } });
  const { data: quotations, isLoading: qLoading } = useQuery({ queryKey: ["quotations"], queryFn: () => fetchQuotations({ limit: "50" }) });
  const { data: expenses, isLoading: eLoading } = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses({ limit: "50" }) });

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

  const createInvMutation = useMutation({
    mutationFn: () => {
      const total = parseFloat(invForm.amount);
      return createInvoice({
        customerId: invCustomer!.id,
        subscriptionId: invForm.subscriptionId ? parseInt(invForm.subscriptionId) : undefined,
        gstInclusive: true,
        items: [{
          description: invForm.description || `${invForm.invoiceType} purchase`,
          quantity: 1,
          unitPrice: total,
          total,
        }],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      setInvOpen(false);
      setInvCustomer(null);
      setInvForm({ description: "", amount: "", subscriptionId: "", invoiceType: "package" });
      toast({ title: "Invoice created" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Billing & Finance</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Invoices, quotations, payments, and expenses</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={invOpen} onOpenChange={setInvOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="btn-create-invoice">
                  <FileText size={15} className="mr-1.5" />Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Customer</Label>
                    <CustomerSearchSelect
                      value={invCustomer}
                      onChange={setInvCustomer}
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={invForm.invoiceType} onValueChange={v => setInvForm(f => ({ ...f, invoiceType: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="package">Wash package</SelectItem>
                        <SelectItem value="solar_amc">Solar AMC</SelectItem>
                        <SelectItem value="manual">Manual invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={invForm.description} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="e.g. 6-month wash package" />
                  </div>
                  <div>
                    <Label>Amount (₹, GST inclusive)</Label>
                    <Input type="number" value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" data-testid="input-invoice-amount" />
                  </div>
                  <div>
                    <Label>Subscription ID (optional)</Label>
                    <Input value={invForm.subscriptionId} onChange={e => setInvForm(f => ({ ...f, subscriptionId: e.target.value }))} className="mt-1" />
                  </div>
                  <Button onClick={() => createInvMutation.mutate()} disabled={createInvMutation.isPending || !invCustomer || !invForm.amount} className="w-full bg-primary text-secondary hover:bg-primary/90" data-testid="btn-submit-invoice">
                    {createInvMutation.isPending ? "Creating..." : "Create invoice"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-record-payment">
                <PlusCircle size={15} className="mr-1.5" />Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Customer</Label>
                  <CustomerSearchSelect value={payCustomer} onChange={setPayCustomer} />
                </div>
                {[["invoiceId", "Invoice ID (optional)", "number"], ["amount", "Amount (\u20b9)", "number"]].map(([k, l, t]) => (
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
                <Button onClick={() => payMutation.mutate({ data: { ...payForm, customerId: payCustomer!.id, invoiceId: payForm.invoiceId ? parseInt(payForm.invoiceId) : undefined, amount: parseFloat(payForm.amount) } as any })}
                  disabled={payMutation.isPending || !payCustomer || !payForm.amount} className="w-full bg-primary text-secondary hover:bg-primary/90" data-testid="btn-submit-payment">
                  {payMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>{["Invoice #", "Customer", "Total", "Paid", "Balance", "Status", "Due Date", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>) :
                    (invoices?.data ?? []).map(inv => (
                      <tr key={inv.id} className="hover:bg-muted/20" data-testid={`invoice-row-${inv.id}`}>
                        <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 font-medium">{inv.customerName}</td>
                        <td className="px-4 py-3">\u20b9{Number(inv.totalAmount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-green-600">\u20b9{Number(inv.paidAmount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3">
                          {Number((inv as any).balanceDue ?? 0) > 0 ? <span className="text-destructive font-medium">\u20b9{Number((inv as any).balanceDue).toLocaleString("en-IN")}</span> : <span className="text-green-600">\u20b9{Number((inv as any).balanceDue).toLocaleString("en-IN")}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${statusColors[inv.status ?? "draft"]}`}>{inv.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{inv.dueDate ?? "\u2014"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              <FileDown size={12} />PDF
                            </a>
                            {(inv as any).quotationId && (
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
              {!isLoading && (invoices?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No invoices found</div>}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>{["Customer", "Amount", "Method", "Transaction ID", "Received By", "Date"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(payments?.data ?? []).map(p => (
                    <tr key={p.id} className="hover:bg-muted/20" data-testid={`payment-row-${p.id}`}>
                      <td className="px-4 py-3 font-medium">{p.customerName}</td>
                      <td className="px-4 py-3 font-semibold text-primary">\u20b9{Number(p.amount).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 uppercase text-xs text-muted-foreground">{p.method}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.transactionId ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{(p as any).receivedByStaffId ?? "\u2014"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.createdAt!).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(payments?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No payments found</div>}
            </div>
          </TabsContent>

          <TabsContent value="quotations" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>{["Quotation #", "Customer", "Subtotal", "GST", "Total", "Status", "Valid Until"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {qLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>) :
                    (quotations?.data ?? []).map((q: any) => (
                      <tr key={q.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{q.quotationNumber}</td>
                        <td className="px-4 py-3 font-medium">{q.customerName}</td>
                        <td className="px-4 py-3">\u20b9{Number(q.subtotal).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">\u20b9{Number(q.gstAmount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 font-semibold">\u20b9{Number(q.totalAmount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${qStatusColors[q.status ?? "draft"]}`}>{q.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.validUntil ?? "\u2014"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!qLoading && (quotations?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No quotations found</div>}
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>{["Category", "Description", "Vendor", "Amount", "Date", "Paid By"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {eLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>) :
                    (expenses?.data ?? []).map((e: any) => (
                      <tr key={e.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{e.category}</Badge></td>
                        <td className="px-4 py-3">{e.description ?? "\u2014"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{e.vendor ?? "\u2014"}</td>
                        <td className="px-4 py-3 font-semibold text-destructive">\u20b9{Number(e.amount).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(e.expenseDate).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{e.paidBy ?? "\u2014"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!eLoading && (expenses?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No expenses recorded</div>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
