import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function AdminQuotationBuilder() {
  const { toast } = useToast();
  const [items, setItems] = useState<{ name: string; quantity: number; unitPrice: number; total: number }[]>([
    { name: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const disc = parseFloat(discount || "0");
  const gst = Math.round((subtotal - disc) * 0.18 * 100) / 100;
  const total = Math.round((subtotal - disc + gst) * 100) / 100;

  const updateItem = (idx: number, field: string, val: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: field === "name" ? val : parseFloat(val || "0") };
      if (field === "quantity" || field === "unitPrice") {
        next.total = Math.round(next.quantity * next.unitPrice * 100) / 100;
      }
      return next;
    }));
  };

  const addRow = () => setItems(prev => [...prev, { name: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const removeRow = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!customerId) { toast({ title: "Customer ID required", variant: "destructive" }); return; }
    if (items.some(i => !i.name)) { toast({ title: "All items must have a name", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: parseInt(customerId),
          items,
          discount: disc,
          validUntil: validUntil || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Quotation created" });
      setItems([{ name: "", quantity: 1, unitPrice: 0, total: 0 }]);
      setCustomerId("");
      setDiscount("0");
      setValidUntil("");
      setNotes("");
    } catch {
      toast({ title: "Failed to create quotation", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Quotation Builder</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create GST-inclusive quotations</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer ID</Label>
                    <Input type="number" value={customerId} onChange={e => setCustomerId(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Valid Until</Label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Rate</div>
                  <div className="col-span-2">Total</div>
                  <div className="col-span-1"></div>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input value={item.name} onChange={e => updateItem(idx, "name", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={0} value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} />
                    </div>
                    <div className="col-span-2 text-sm font-medium">
                      \u20b9{item.total.toLocaleString("en-IN")}
                    </div>
                    <div className="col-span-1">
                      <button onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addRow} className="w-full">
                  <Plus size={14} className="mr-1" /> Add Item
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm">Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>\u20b9{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-24 h-7 text-sm" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST (18%)</span>
                  <span>\u20b9{gst.toLocaleString("en-IN")}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">\u20b9{total.toLocaleString("en-IN")}</span>
                </div>
                <Button onClick={save} disabled={saving} className="w-full bg-primary text-secondary hover:bg-primary/90">
                  {saving ? "Saving..." : "Save Quotation"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
