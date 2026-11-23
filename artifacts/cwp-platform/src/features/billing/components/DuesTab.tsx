import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { EmptyState } from "@/lib/design-system/EmptyState";

async function fetchBillingHealth(branchId?: number | null) {
  const url = branchId ? `/api/billing/health?branchId=${branchId}` : "/api/billing/health";
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchDues(customerId?: string, branchId?: number | null) {
  const url = new URL("/api/billing/dues", window.location.origin);
  url.searchParams.set("limit", "50");
  if (customerId) url.searchParams.set("customerId", customerId);
  if (branchId) url.searchParams.set("branchId", String(branchId));
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type Props = {
  customerId?: string;
};

export function DuesTab({ customerId }: Props) {
  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const { data: health, isLoading: hLoading } = useQuery({
    queryKey: ["billingHealth", activeBranchId],
    queryFn: () => fetchBillingHealth(activeBranchId),
  });
  const { data: dues, isLoading: dLoading } = useQuery({
    queryKey: ["billingDues", customerId, activeBranchId],
    queryFn: () => fetchDues(customerId, activeBranchId),
  });

  const fmt = (n: number) =>
    `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {hLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : (
            <>
              <Card>
                <CardContent className="p-4">
                  <p className="text-muted-foreground text-xs uppercase">Collected This Month</p>
                  <p className="font-display font-bold text-xl text-green-600 mt-1 tabular-nums">{fmt(health?.collectedThisMonth)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-muted-foreground text-xs uppercase">Dues Outstanding</p>
                  <p className="font-display font-bold text-xl text-destructive mt-1 tabular-nums">{fmt(health?.duesOutstanding)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-muted-foreground text-xs uppercase">Expenses This Month</p>
                  <p className="font-display font-bold text-xl text-amber-500 mt-1 tabular-nums">{fmt(health?.expensesThisMonth)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-muted-foreground text-xs uppercase">Net</p>
                  <p className="font-display font-bold text-xl text-primary mt-1 tabular-nums">{fmt(health?.net)}</p>
                </CardContent>
              </Card>
            </>
          )}
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">Outstanding Dues by Customer</h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoices</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={3} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                  ))
                  : (dues?.data ?? []).map((d: { customerId: number; customerName: string; invoiceCount: number; totalDue: number }) => (
                    <tr key={d.customerId} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/admin/customers/${d.customerId}?tab=billing`} className="text-primary hover:underline">
                          {d.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{d.invoiceCount}</td>
                      <td className="px-4 py-3 text-right font-semibold text-destructive font-mono tabular-nums">
                        ₹{(d.totalDue ?? 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!dLoading && (dues?.data ?? []).length === 0 && (
              <EmptyState
                icon="check_circle"
                title="No outstanding dues"
                description="All customer accounts have cleared invoices and settled payments."
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
