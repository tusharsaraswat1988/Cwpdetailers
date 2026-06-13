import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useGetCustomer,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useListVehicles,
  getListVehiclesQueryKey,
  useListStaff,
  getListStaffQueryKey,
  useUpdateVehicle,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, IndianRupee, Wallet, Car } from "lucide-react";
import { Link } from "wouter";
import CommunicationTimeline from "@/features/communications/components/CommunicationTimeline";

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

async function fetchWallet(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load wallet");
  return res.json();
}

async function fetchWalletTransactions(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet/transactions?limit=20`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load transactions");
  return res.json() as Promise<{ data: WalletTx[]; total: number }>;
}

async function creditWallet(id: number, body: { amount: number; paymentMode: string; notes?: string }) {
  const res = await fetch(`/api/customers/${id}/wallet/credit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Credit failed");
  }
  return res.json();
}

export default function AdminCustomerDetail() {
  const [, params] = useRoute("/admin/customers/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("upi");
  const [notes, setNotes] = useState("");

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { queryKey: getGetCustomerQueryKey(id), enabled: id > 0 },
  });

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", id],
    queryFn: () => fetchWallet(id),
    enabled: id > 0,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["wallet-transactions", id],
    queryFn: () => fetchWalletTransactions(id),
    enabled: id > 0,
  });

  const { data: vehicles, isLoading: vehiclesLoading } = useListVehicles(
    { customerId: String(id) } as any,
    { query: { queryKey: getListVehiclesQueryKey({ customerId: String(id) } as any), enabled: id > 0 } },
  );

  const { data: staffList } = useListStaff(
    { status: "active" } as any,
    { query: { queryKey: getListStaffQueryKey({ status: "active" } as any), enabled: id > 0 } },
  );

  const assignStaffMutation = useUpdateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey({ customerId: String(id) } as any) });
        qc.invalidateQueries({ queryKey: ["daily-ops"] });
        toast({ title: "Staff assignment updated" });
      },
      onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
    },
  });

  const creditMutation = useMutation({
    mutationFn: () => creditWallet(id, {
      amount: parseFloat(amount),
      paymentMode,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet", id] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions", id] });
      qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
      qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      setAmount("");
      setNotes("");
      toast({ title: "Wallet credited successfully" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (!id) return null;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Back to customers
        </Link>

        {isLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : (
          <div>
            <h1 className="font-display font-bold text-2xl">{customer?.name}</h1>
            <p className="text-muted-foreground text-sm">{customer?.phone} · {customer?.city ?? "—"}</p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet size={16} className="text-primary" /> Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {walletLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-primary flex items-center gap-1">
                <IndianRupee size={20} />
                {(wallet?.balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            )}
            {wallet?.isLowBalance && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                Low balance (below {wallet.lowBalanceThresholdDays} days)
              </Badge>
            )}

            <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-border">
              <div>
                <Label htmlFor="credit-amount">Amount (₹)</Label>
                <Input
                  id="credit-amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1"
                  data-testid="input-wallet-credit-amount"
                />
              </div>
              <div>
                <Label>Payment mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="mt-1" data-testid="select-wallet-payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="credit-notes">Remarks</Label>
                <Input
                  id="credit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  placeholder="Optional"
                  data-testid="input-wallet-credit-notes"
                />
              </div>
            </div>
            <Button
              onClick={() => creditMutation.mutate()}
              disabled={creditMutation.isPending || !amount || parseFloat(amount) <= 0}
              className="bg-primary text-secondary hover:bg-primary/90"
              data-testid="btn-wallet-credit"
            >
              {creditMutation.isPending ? "Adding..." : "Add wallet credit"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Car size={16} className="text-primary" /> Vehicles & staff assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vehiclesLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (vehicles ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicles registered</p>
            ) : (
              <div className="space-y-3">
                {(vehicles ?? []).map((v: any) => (
                  <div key={v.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border" data-testid={`vehicle-staff-${v.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{v.registrationNumber}</p>
                      <p className="text-xs text-muted-foreground">{v.make} {v.model} · {v.vehicleType}</p>
                    </div>
                    <Select
                      value={v.assignedStaffId ? String(v.assignedStaffId) : "none"}
                      onValueChange={(val) => {
                        assignStaffMutation.mutate({
                          id: v.id,
                          data: { assignedStaffId: val === "none" ? null : parseInt(val, 10) } as any,
                        });
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-48" data-testid={`select-staff-${v.id}`}>
                        <SelectValue placeholder="Assign staff" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(staffList ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Transaction ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (txData?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {(txData?.data ?? []).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                    data-testid={`wallet-tx-${tx.id}`}
                  >
                    <div>
                      <Badge variant="outline" className={`text-xs capitalize ${tx.type === "credit" ? "text-green-500 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
                        {tx.type}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tx.reference?.replace(/_/g, " ") ?? "—"}
                        {tx.paymentMode ? ` · ${tx.paymentMode}` : ""}
                      </p>
                      {tx.notes && <p className="text-xs text-muted-foreground">{tx.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.type === "credit" ? "text-green-500" : "text-red-400"}`}>
                        {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bal ₹{tx.balanceAfter.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Communication timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <CommunicationTimeline customerId={id} />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
