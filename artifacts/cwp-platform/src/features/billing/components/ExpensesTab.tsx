import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { queuedFetch } from "@/services/queuedApi";
import { moduleError, queuedSuccessMessage, SERVER_CONFIRMATION_REQUIRED } from "@/lib/moduleErrors";
import { fetchWithRetry } from "@/services/apiRetry";
import ErrorState from "@/components/shared/ErrorState";

const categories = ["salary", "rent", "utilities", "materials", "marketing", "travel", "maintenance", "other"];

const defaultExpenseForm = {
  category: "materials",
  amount: "",
  description: "",
  vendor: "",
  paidBy: "",
  expenseDate: "",
};

async function fetchExpenses(params?: Record<string, string>): Promise<any> {
  const url = new URL("/api/expenses", window.location.origin);
  Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetchWithRetry(url.toString());
  if (!res.ok) throw new Error(moduleError("expenses", "load"));
  return res.json();
}

export function ExpensesTab() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { value: form, setValue: setForm, clearDraft, restoredFromDraft } = useFormDraft(
    "admin-expense-form",
    defaultExpenseForm,
  );
  const { data: expenses, isLoading, isError, refetch } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => fetchExpenses({ limit: "50" }),
  });

  const save = async () => {
    if (!form.amount || !form.expenseDate) {
      toast({ title: "Amount and date required", variant: "destructive" });
      return;
    }
    const payload = {
      category: form.category,
      amount: parseFloat(form.amount),
      description: form.description || undefined,
      vendor: form.vendor || undefined,
      paidBy: form.paidBy || undefined,
      expenseDate: form.expenseDate,
    };

    const result = await queuedFetch(
      "/api/expenses",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { operationType: "expense", label: "Record expense" },
    );

    if (result.queued) {
      toast({ title: queuedSuccessMessage("Expense") });
      await clearDraft();
      setForm(defaultExpenseForm);
      setOpen(false);
      return;
    }

    if (!result.ok) {
      toast({
        title: result.requiresServerConfirmation ? SERVER_CONFIRMATION_REQUIRED : moduleError("expenses", "save"),
        variant: "destructive",
      });
      return;
    }

    if (!result.response.ok) {
      toast({ title: moduleError("expenses", "save"), variant: "destructive" });
      return;
    }

    toast({ title: "Expense recorded" });
    await clearDraft();
    setForm(defaultExpenseForm);
    setOpen(false);
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(!open)} variant="outline" size="sm">
          <PlusCircle size={15} className="mr-1.5" />{open ? "Close" : "Add Expense"}
        </Button>
      </div>

      {open && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {restoredFromDraft && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                Restored unsaved expense draft from your device.
              </p>
            )}
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
                <Label>Amount (₹)</Label>
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
            <Button onClick={save}>Save Expense</Button>
          </CardContent>
        </Card>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isError ? (
          <ErrorState title={moduleError("expenses", "load")} onRetry={() => refetch()} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {["Category", "Description", "Vendor", "Amount", "Date", "Paid By"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                  ))
                  : (expenses?.data ?? []).map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{e.category}</Badge></td>
                      <td className="px-4 py-3">{e.description ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.vendor ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-destructive">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(e.expenseDate).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.paidBy ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!isLoading && (expenses?.data ?? []).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No expenses recorded</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
