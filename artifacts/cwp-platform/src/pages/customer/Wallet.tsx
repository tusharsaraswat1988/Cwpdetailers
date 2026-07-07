import { useAccountScope } from "@/lib/account-scope";
import { useGetCustomerSummary, getGetCustomerSummaryQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { fetchWalletSummary, fetchWalletTransactions } from "@/lib/customer-wallet";
import {
  ArrowDownLeft, ArrowUpRight, IndianRupee, Phone, MessageCircle, FileText,
} from "lucide-react";
import { Link } from "wouter";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { useBranding } from "@/lib/branding";

export default function CustomerWallet() {
  const branding = useBranding();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } =
    useGetCustomerSummary(customerId ?? 0, {
      query: {
        queryKey: getGetCustomerSummaryQueryKey(customerId ?? 0),
        enabled: customerId != null,
      },
    });

  const { data: walletSummary, isLoading: walletLoading } = useQuery({
    queryKey: ["customer-wallet-summary", customerId],
    queryFn: () => fetchWalletSummary(customerId!),
    enabled: customerId != null,
  });

  const { data: walletTx, isLoading: txLoading, isError: txError, refetch: refetchTx } = useQuery({
    queryKey: ["customer-wallet-tx-full", customerId],
    queryFn: () => fetchWalletTransactions(customerId!, 50),
    enabled: customerId != null,
  });

  const isLoading = summaryLoading || walletLoading || txLoading;
  const pendingDues = summary?.pendingDues ?? 0;
  const balance = walletSummary?.balance ?? summary?.walletBalance ?? 0;

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <NoCustomerProfileMessage />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">Wallet</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Balance, transactions & dues</p>
        </div>

        {/* Hero balance */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card overflow-hidden" data-testid="wallet-balance-hero">
          <CardContent className="p-5">
            {isLoading ? (
              <Skeleton className="h-16 w-40" />
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IndianRupee size={28} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Available balance</p>
                  <p className="font-display font-bold text-3xl text-green-600 tabular-nums" data-testid="wallet-balance-amount">
                    ₹{Number(balance).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dues */}
        {pendingDues > 0 && (
          <Card className="border-destructive/30" data-testid="wallet-dues-section">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Outstanding dues</p>
                <p className="font-display font-bold text-xl text-destructive tabular-nums">
                  ₹{Number(pendingDues).toLocaleString("en-IN")}
                </p>
              </div>
              <Link href="/customer/invoices">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <FileText size={14} /> View invoices
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Recharge info */}
        <Card className="bg-muted/30" data-testid="wallet-recharge-info">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-sm">Recharge your wallet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To add funds, contact {branding.brandName} via WhatsApp or call. We accept cash, UPI, and bank transfer.
              Your balance is credited after payment confirmation.
            </p>
            <div className="flex gap-2">
              <a
                href="tel:+919999999999"
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
                data-testid="wallet-call-cwp"
              >
                <Phone size={15} className="text-green-600" /> Call {branding.brandName}
              </a>
              <a
                href="https://wa.me/919999999999"
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
                data-testid="wallet-whatsapp-cwp"
              >
                <MessageCircle size={15} className="text-green-600" /> WhatsApp
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <div>
          <h2 className="font-semibold text-base mb-3">Transaction history</h2>
          {txError || summaryError ? (
            <ErrorState onRetry={() => { refetchTx(); refetchSummary(); }} />
          ) : txLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (walletTx?.data ?? []).length === 0 ? (
            <EmptyState
              icon={<IndianRupee size={20} />}
              title="No transactions yet"
              description="Wallet credits and debits will appear here"
            />
          ) : (
            <div className="space-y-2">
              {(walletTx?.data ?? []).map(tx => (
                <Card key={tx.id} data-testid={`wallet-tx-${tx.id}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        {tx.type === "credit"
                          ? <ArrowDownLeft size={16} className="text-green-600" />
                          : <ArrowUpRight size={16} className="text-red-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm capitalize">{tx.type}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.reference?.replace(/_/g, " ") ?? "Wallet transaction"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-semibold tabular-nums ${tx.type === "credit" ? "text-green-600" : "text-red-500"}`}>
                        {tx.type === "credit" ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN")}
                      </p>
                      {tx.balanceAfter != null && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Bal ₹{Number(tx.balanceAfter).toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
