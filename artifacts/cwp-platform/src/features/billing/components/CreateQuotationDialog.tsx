import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { CustomerSearchSelect, type CustomerSearchValue } from "@/features/customers/components/CustomerSearchSelect";

type LineItem = { name: string; quantity: number; unitPrice: number; total: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomerId?: number;
  onCreated?: () => void;
};

async function previewGst(items: LineItem[], discount: number) {
  const res = await fetch("/api/invoices/gst-preview", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map(i => ({
        description: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
        sac: "998533",
        serviceCategory: "general",
      })),
      discount,
      gstInclusive: true,
    }),
  });
  if (!res.ok) throw new Error("GST preview failed");
  return res.json() as Promise<{ subtotal: number; gstAmount: number; totalAmount: number }>;
}

export function CreateQuotationDialog({ open, onOpenChange, initialCustomerId, onCreated }: Props) {
  const { toast } = useToast();
  const [customer, setCustomer] = useState<CustomerSearchValue | null>(null);
  const [items, setItems] = useState<LineItem[]>([{ name: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [discount, setDiscount] = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subtotal: number; gstAmount: number; totalAmount: number } | null>(null);

  const updateItem = (idx: number, field: string, val: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: field === "name" ? val : parseFloat(val || "0") };
      if (field === "quantity" || field === "unitPrice") {
        next.total = Math.round(next.quantity * next.unitPrice * 100) / 100;
      }
      return next;
    }));
    setPreview(null);
  };

  const refreshPreview = async () => {
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) return;
    try {
      const p = await previewGst(validItems, parseFloat(discount || "0"));
      setPreview(p);
    } catch {
      setPreview(null);
    }
  };

  const save = async () => {
    if (!customer && !initialCustomerId) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer?.id ?? initialCustomerId,
          items: validItems.map(i => ({
            description: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            sac: "998533",
            serviceCategory: "general",
          })),
          discount: parseFloat(discount || "0"),
          validUntil: validUntil || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Quotation created" });
      onCreated?.();
      onOpenChange(false);
      setItems([{ name: "", quantity: 1, unitPrice: 0, total: 0 }]);
      setCustomer(null);
      setDiscount("0");
      setValidUntil("");
      setNotes("");
      setPreview(null);
    } catch {
      toast({ title: "Failed to create quotation", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Quotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Customer</Label>
            <CustomerSearchSelect value={customer} onChange={setCustomer} testId="quotation-create-customer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valid until</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <Input type="number" value={discount} onChange={e => { setDiscount(e.target.value); setPreview(null); }} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
          </div>
          <div className="space-y-2">
            <Label>Line items</Label>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-5" value={item.name} placeholder="Item" onChange={e => updateItem(idx, "name", e.target.value)} />
                <Input className="col-span-2" type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} />
                <Input className="col-span-2" type="number" min={0} value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} />
                <span className="col-span-2 text-sm">₹{item.total.toLocaleString("en-IN")}</span>
                <button type="button" className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, { name: "", quantity: 1, unitPrice: 0, total: 0 }])}>
              <Plus size={14} className="mr-1" /> Add row
            </Button>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={refreshPreview}>Refresh GST preview</Button>
          {preview && (
            <div className="rounded-lg bg-muted/40 border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Taxable</span><span>₹{preview.subtotal.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between"><span>GST</span><span>₹{preview.gstAmount.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>₹{preview.totalAmount.toLocaleString("en-IN")}</span></div>
            </div>
          )}
          <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving..." : "Save quotation"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
