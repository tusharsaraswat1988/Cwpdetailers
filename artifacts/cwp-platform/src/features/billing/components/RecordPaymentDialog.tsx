import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getListInvoicesQueryKey, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle } from "lucide-react";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefillCustomerId?: number;
  trigger?: boolean;
};

async function fetchWalletBalance(customerId: number) {
  const res = await fetch(`/api/customers/${customerId}/wallet`, { credentials: "include" });
  if (!res.ok) return { balance: 0 };
  return res.json() as Promise<{ balance: number }>;
}

type OpenInvoice = {
  id: number;
  invoiceNumber: string;
  balanceDue: string;
  totalAmount: string;
  paidAmount: string;
};

async function fetchOpenInvoices(customerId: number): Promise<OpenInvoice[]> {
  const res = await fetch(
    `/api/invoices?customerId=${customerId}&hasBalance=true&limit=20`,
    { credentials: "include" },
  );
  if (!res.ok) return [];
  const payload = await res.json() as { data?: OpenInvoice[] };
  const rows = payload.data ?? [];
  return [...rows].sort((a, b) => a.id - b.id);
}

export function RecordPaymentDialog({ open: controlledOpen, onOpenChange, prefillCustomerId, trigger = true }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [payCustomer, setPayCustomer] = useState<CustomerSearchValue | null>(null);
  const [payForm, setPayForm] = useState({ invoiceId: "", amount: "", method: "upi", useWallet: false });
  const [submitting, setSubmitting] = useState(false);

  const customerId = payCustomer?.id ?? 0;

  const { data: wallet } = useQuery({
    queryKey: ["wallet", customerId, "payment-dialog"],
    queryFn: () => fetchWalletBalance(customerId),
    enabled: customerId > 0,
  });

  const { data: openInvoices = [] } = useQuery({
    queryKey: ["invoices", "open", customerId, "payment-dialog"],
    queryFn: () => fetchOpenInvoices(customerId),
    enabled: customerId > 0,
  });

  useEffect(() => {
    if (prefillCustomerId && prefillCustomerId > 0 && !payCustomer) {
      fetch(`/api/customers/${prefillCustomerId}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(c => {
          if (c) setPayCustomer({ id: c.id, name: c.name ?? `Customer #${c.id}`, phone: c.phone ?? "" });
        })
        .catch(() => {});
    }
  }, [prefillCustomerId, payCustomer]);

  useEffect(() => {
    if (openInvoices.length === 0) return;
    const oldest = openInvoices[0]!;
    const due = parseFloat(oldest.balanceDue || "0");
    setPayForm(prev => {
      if (prev.invoiceId) return prev;
      return {
        ...prev,
        invoiceId: String(oldest.id),
        amount: due > 0 && !prev.amount ? String(due) : prev.amount,
      };
    });
  }, [openInvoices]);

  const submit = async () => {
    if (!payCustomer) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    const amount = parseFloat(payForm.amount || "0");
    if (amount <= 0 && !payForm.useWallet) {
      toast({ title: "Enter amount or enable pay with wallet", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: payCustomer.id,
          invoiceId: payForm.invoiceId ? parseInt(payForm.invoiceId, 10) : undefined,
          amount,
          method: payForm.method,
          useWallet: payForm.useWallet,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      setPayForm({ invoiceId: "", amount: "", method: "upi", useWallet: false });
      toast({ title: "Payment recorded" });
    } catch (err) {
      toast({
        title: "Failed to record payment",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const dialogBody = (
    <DialogContent>
      <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
      <div className="space-y-4 mt-2">
        <div>
          <Label>Customer</Label>
          <CustomerSearchSelect value={payCustomer} onChange={setPayCustomer} />
        </div>
        {customerId > 0 && (
          <p className="text-sm text-muted-foreground">
            Wallet balance: <span className="font-medium text-primary">₹{(wallet?.balance ?? 0).toLocaleString("en-IN")}</span>
          </p>
        )}
        {customerId > 0 && openInvoices.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Applying to oldest open invoice:{" "}
            <span className="font-medium text-foreground">
              {openInvoices[0]!.invoiceNumber}
            </span>
            {" "}(balance ₹{parseFloat(openInvoices[0]!.balanceDue || "0").toLocaleString("en-IN")})
          </p>
        )}
        <div>
          <Label>Invoice ID</Label>
          <Input
            data-testid="input-pay-invoiceId"
            type="number"
            value={payForm.invoiceId}
            onChange={e => setPayForm(f => ({ ...f, invoiceId: e.target.value }))}
            className="mt-1"
            placeholder={openInvoices.length ? "Auto-filled from oldest open invoice" : "Optional — links payment to invoice"}
          />
        </div>
        <div>
          <Label>External amount (₹)</Label>
          <Input
            data-testid="input-pay-amount"
            type="number"
            min={0}
            value={payForm.amount}
            onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="use-wallet"
            checked={payForm.useWallet}
            onCheckedChange={v => setPayForm(f => ({ ...f, useWallet: !!v }))}
            disabled={!payForm.invoiceId}
          />
          <Label htmlFor="use-wallet" className="text-sm cursor-pointer">
            Apply wallet balance to invoice {payForm.invoiceId ? "" : "(requires invoice ID)"}
          </Label>
        </div>
        <div>
          <Label>Method</Label>
          <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
            <SelectTrigger className="mt-1" data-testid="select-payment-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["cash", "upi", "card", "bank_transfer", "razorpay"].map(m => (
                <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={submit}
          disabled={submitting || !payCustomer}
          className="w-full bg-primary text-secondary hover:bg-primary/90"
          data-testid="btn-submit-payment"
        >
          {submitting ? "Recording..." : "Record Payment"}
        </Button>
      </div>
    </DialogContent>
  );

  if (!trigger) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogBody}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="btn-record-payment">
          <PlusCircle size={15} className="mr-1.5" />Record Payment
        </Button>
      </DialogTrigger>
      {dialogBody}
    </Dialog>
  );
}
