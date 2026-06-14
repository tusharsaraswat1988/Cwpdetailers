import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ExternalLink, IndianRupee, Wallet } from "lucide-react";
import { Link } from "wouter";

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
  customerId: number;
};

async function fetchWallet(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load wallet");
  return res.json() as Promise<{ balance: number }>;
}

async function fetchWalletTransactions(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet/transactions?limit=3`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load transactions");
  return res.json() as Promise<{ data: WalletTx[]; total: number }>;
}

export function WalletSummaryPanel({ customerId }: Props) {
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", customerId],
    queryFn: () => fetchWallet(customerId),
    enabled: customerId > 0,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["wallet-transactions", customerId, "summary"],
    queryFn: () => fetchWalletTransactions(customerId),
    enabled: customerId > 0,
  });

  return (
    <div className="space-y-4" data-testid="wallet-summary-panel">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet size={16} className="text-primary" /> Wallet Summary
          </CardTitle>
          <Link href={`/admin/billing?customerId=${customerId}&tab=wallet-adjustments`}>
            <Button variant="ghost" size="sm" className="text-xs h-8">
              <ExternalLink size={12} className="mr-1" /> Adjust in Billing
            </Button>
          </Link>
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
          <p className="text-xs text-muted-foreground">
            Wallet holds money adjustments only. Wash credits and visit balances live on service contracts — not here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (txData?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet transactions yet</p>
          ) : (
            <div className="space-y-2">
              {(txData?.data ?? []).map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border text-sm"
                  data-testid={`wallet-summary-tx-${tx.id}`}
                >
                  <div>
                    <Badge variant="outline" className={`text-xs capitalize ${tx.type === "credit" ? "text-green-600 border-green-600/30" : "text-red-400 border-red-500/30"}`}>
                      {tx.type}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                      {tx.paymentMode ? ` · ${tx.paymentMode}` : ""}
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
    </div>
  );
}
