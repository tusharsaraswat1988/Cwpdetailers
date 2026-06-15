import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";
import { useGetCustomer } from "@workspace/api-client-react";

type WalletTx = {
  id: number;
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  reference?: string | null;
  paymentMode?: string | null;
  notes?: string | null;
  createdAt: string;
};

type Props = {
  customerId?: string;
  prefillCustomerId?: number;
};

async function fetchWallet(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{ balance: number }>;
}

async function fetchWalletTransactions(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet/transactions?limit=50`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{ data: WalletTx[]; total: number }>;
}

export function WalletAdjustmentsTab({ customerId, prefillCustomerId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [customer, setCustomer] = useState<CustomerSearchValue | null>(null);
  const [creditForm, setCreditForm] = useState({ amount: "", paymentMode: "upi", notes: "" });
  const [debitForm, setDebitForm] = useState({ amount: "", reason: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const resolvedId = customer?.id ?? (prefillCustomerId && prefillCustomerId > 0 ? prefillCustomerId : 0);

  const { data: prefetched } = useGetCustomer(prefillCustomerId ?? 0, {
    query: { enabled: !!prefillCustomerId && prefillCustomerId > 0 },
  });

  useEffect(() => {
    if (prefetched && prefillCustomerId) {
      setCustomer({
        id: prefetched.id!,
        name: prefetched.name ?? `Customer #${prefillCustomerId}`,
        phone: prefetched.phone ?? "",
      });
    }
  }, [prefetched, prefillCustomerId]);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", resolvedId],
    queryFn: () => fetchWallet(resolvedId),
    enabled: resolvedId > 0,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["wallet-transactions", resolvedId, customerId],
    queryFn: () => fetchWalletTransactions(resolvedId),
    enabled: resolvedId > 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wallet", resolvedId] });
    qc.invalidateQueries({ queryKey: ["wallet-transactions", resolvedId] });
    qc.invalidateQueries({ queryKey: ["customer", resolvedId, "billing-summary"] });
  };

  const submitCredit = async () => {
    if (!customer) return;
    const amount = parseFloat(creditForm.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a positive amount (₹)", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/wallet/credit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMode: creditForm.paymentMode,
          notes: creditForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast({ title: "Wallet credited" });
      setCreditForm({ amount: "", paymentMode: "upi", notes: "" });
      invalidate();
    } catch (err) {
      toast({
        title: "Wallet top-up failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitDebit = async () => {
    if (!customer) return;
    const amount = parseFloat(debitForm.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter a positive amount (₹)", variant: "destructive" });
      return;
    }
    if (!debitForm.reason.trim()) {
      toast({ title: "Reason is required for wallet debits", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/wallet/debit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: debitForm.reason.trim(),
          notes: debitForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast({ title: "Wallet debited" });
      setDebitForm({ amount: "", reason: "", notes: "" });
      invalidate();
    } catch (err) {
      toast({
        title: "Debit failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="wallet-adjustments-tab">
      <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/20 px-3 py-2">
        Wallet holds <strong>₹ money adjustments only</strong>. Wash credits and visit balances live on service contracts — not here.
      </p>

      <div>
        <Label>Customer</Label>
        <div className="mt-1 max-w-md">
          <CustomerSearchSelect value={customer} onChange={setCustomer} testId="wallet-adjustment-customer" />
        </div>
      </div>

      {customer && (
        <>
          {walletLoading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <p className="text-2xl font-bold text-primary">
              ₹{(wallet?.balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          )}

          <Tabs defaultValue="credit">
            <TabsList>
              <TabsTrigger value="credit">Add money</TabsTrigger>
              <TabsTrigger value="debit">Deduct</TabsTrigger>
            </TabsList>
            <TabsContent value="credit" className="mt-3">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={creditForm.amount}
                      onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Payment mode</Label>
                    <Select value={creditForm.paymentMode} onValueChange={v => setCreditForm(f => ({ ...f, paymentMode: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["cash", "upi", "bank_transfer"].map(m => (
                          <SelectItem key={m} value={m}>{m.replace(/_/g, " ").toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={creditForm.notes} onChange={e => setCreditForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" />
                  </div>
                  <Button onClick={submitCredit} disabled={submitting} className="w-full sm:w-auto">
                    {submitting ? "Processing..." : "Add to wallet"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="debit" className="mt-3">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={debitForm.amount}
                      onChange={e => setDebitForm(f => ({ ...f, amount: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Reason *</Label>
                    <Input
                      value={debitForm.reason}
                      onChange={e => setDebitForm(f => ({ ...f, reason: e.target.value }))}
                      placeholder="Required for audit — e.g. billing correction"
                      className="mt-1"
                      data-testid="wallet-debit-reason"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={debitForm.notes} onChange={e => setDebitForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" />
                  </div>
                  <Button onClick={submitDebit} disabled={submitting} variant="destructive" className="w-full sm:w-auto">
                    {submitting ? "Processing..." : "Debit wallet (₹)"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transaction ledger</CardTitle>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (txData?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No wallet transactions yet</p>
              ) : (
                <div className="space-y-2">
                  {(txData?.data ?? []).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border text-sm">
                      <div>
                        <Badge variant="outline" className={`text-xs capitalize ${tx.type === "credit" ? "text-green-600 border-green-600/30" : "text-red-400 border-red-500/30"}`}>
                          {tx.type}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                          {tx.paymentMode ? ` · ${tx.paymentMode}` : ""}
                          {tx.notes ? ` · ${tx.notes}` : ""}
                        </p>
                      </div>
                      <p className={`font-semibold ${tx.type === "credit" ? "text-green-600" : "text-red-400"}`}>
                        {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
