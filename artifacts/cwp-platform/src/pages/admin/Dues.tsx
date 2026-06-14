import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IndianRupee } from "lucide-react";
import { Link } from "wouter";

async function fetchBillingHealth() {
  const res = await fetch("/api/billing/health");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function fetchDues() {
  const res = await fetch("/api/billing/dues?limit=50");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function AdminDues() {
  const { data: health, isLoading: hLoading } = useQuery({ queryKey: ["billingHealth"], queryFn: fetchBillingHealth });
  const { data: dues, isLoading: dLoading } = useQuery({ queryKey: ["billingDues"], queryFn: fetchDues });

  const fmt = (n: number) => `\u20b9${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Dues & Collections</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Outstanding payments and collection status</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {hLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) : (
            <>
              <Card><CardContent className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Collected This Month</p>
                <p className="font-display font-bold text-xl text-green-600 mt-1">{fmt(health?.collectedThisMonth)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Dues Outstanding</p>
                <p className="font-display font-bold text-xl text-destructive mt-1">{fmt(health?.duesOutstanding)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Expenses This Month</p>
                <p className="font-display font-bold text-xl text-amber-500 mt-1">{fmt(health?.expensesThisMonth)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Net</p>
                <p className="font-display font-bold text-xl text-primary mt-1">{fmt(health?.net)}</p>
              </CardContent></Card>
            </>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Outstanding Dues by Customer</h3>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>{["Customer", "Invoices", "Total Due"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={3} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>) :
                    (dues?.data ?? []).map((d: any) => (
                      <tr key={d.customerId} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          <Link href={`/admin/customers/${d.customerId}?tab=billing`} className="text-primary hover:underline">
                            {d.customerName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.invoiceCount}</td>
                        <td className="px-4 py-3 font-semibold text-destructive">\u20b9{(d.totalDue ?? 0).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!dLoading && (dues?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No outstanding dues</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
