import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle } from "lucide-react";

const categories = ["salary", "rent", "utilities", "materials", "marketing", "travel", "maintenance", "other"];

async function fetchExpenses(params?: Record<string, string>): Promise<any> {
  const url = new URL("/api/expenses", window.location.origin);
  Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function AdminExpenses() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "materials", amount: "", description: "", vendor: "", paidBy: "", expenseDate: "" });
  const { data: expenses, isLoading, refetch } = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses({ limit: "50" }) });

  const save = async () => {
    if (!form.amount || !form.expenseDate) { toast({ title: "Amount and date required", variant: "destructive" }); return; }
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          amount: parseFloat(form.amount),
          description: form.description || undefined,
          vendor: form.vendor || undefined,
          paidBy: form.paidBy || undefined,
          expenseDate: form.expenseDate,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Expense recorded" });
      setForm({ category: "materials", amount: "", description: "", vendor: "", paidBy: "", expenseDate: "" });
      setOpen(false);
      refetch();
    } catch {
      toast({ title: "Failed to record expense", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Expenses</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Track and manage business expenses</p>
          </div>
          <Button onClick={() => setOpen(!open)} className="bg-primary text-secondary hover:bg-primary/90">
            <PlusCircle size={15} className="mr-1.5" />{open ? "Close" : "Add Expense"}
          </Button>
        </div>

        {open && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount (\u20b9)</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Vendor</Label>
                  <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Paid By</Label>
                  <Input value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <Button onClick={save} className="bg-primary text-secondary hover:bg-primary/90">Save Expense</Button>
            </CardContent>
          </Card>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>{["Category", "Description", "Vendor", "Amount", "Date", "Paid By"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>) :
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
          {!isLoading && (expenses?.data ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No expenses recorded</div>}
        </div>
      </div>
    </AdminLayout>
  );
}
