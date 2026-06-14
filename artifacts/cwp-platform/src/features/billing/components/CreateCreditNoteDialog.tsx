import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: { id: number; invoiceNumber?: string | null; balanceDue?: string | number; totalAmount?: string | number };
  onCreated?: () => void;
};

export function CreateCreditNoteDialog({ open, onOpenChange, invoice, onCreated }: Props) {
  const { toast } = useToast();
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maxCredit = Number(invoice.balanceDue ?? invoice.totalAmount ?? 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/credit-note`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditAmount: creditAmount ? parseFloat(creditAmount) : undefined,
          creditReason: creditReason || "Credit note issued",
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast({ title: "Credit note issued" });
      onCreated?.();
      onOpenChange(false);
      setCreditAmount("");
      setCreditReason("");
      setNotes("");
    } catch (err) {
      toast({
        title: "Credit note failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Credit Note — {invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground">
            GST credit note against original tax invoice. Outstanding balance: ₹{maxCredit.toLocaleString("en-IN")}
          </p>
          <div>
            <Label>Credit amount (₹)</Label>
            <Input
              type="number"
              min={0}
              max={maxCredit}
              value={creditAmount}
              onChange={e => setCreditAmount(e.target.value)}
              placeholder={`Full credit: ${maxCredit}`}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Reason (GST audit)</Label>
            <Input value={creditReason} onChange={e => setCreditReason(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "Issuing..." : "Issue credit note"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
