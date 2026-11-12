import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { qualityApi } from "@/lib/quality/api";
import { AlertCircle, HelpCircle } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: number;
  onCancelled?: () => void;
};

const REASONS = [
  { id: "relocated", label: "Relocated / Moved to another society or city" },
  { id: "quality", label: "Service quality or cleanliness not satisfied" },
  { id: "price", label: "Pricing or budget considerations" },
  { id: "vehicle_sold", label: "Sold or changed my vehicle" },
  { id: "travel", label: "Extended travel (consider pausing instead!)" },
  { id: "other", label: "Other reason" },
];

export function CustomerCancelModal({ open, onOpenChange, subscriptionId, onCancelled }: Props) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>("relocated");
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Please select a cancellation reason", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await qualityApi.cancelSubscriptionWithReason(subscriptionId, {
        reason,
        feedback: feedback.trim() || undefined,
      });
      toast({
        title: "Subscription Cancelled",
        description: "Your daily cleaning plan has been cancelled.",
      });
      onOpenChange(false);
      onCancelled?.();
    } catch (err: any) {
      toast({
        title: "Cancellation Failed",
        description: err.message || "An error occurred while cancelling.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-display font-bold flex items-center gap-2 text-rose-600">
            <AlertCircle size={20} /> Cancel Daily Cleaning Plan
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            We are sorry to see you go. Please let us know the reason so we can improve our services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Reason for Cancellation *</Label>
            <RadioGroup
              value={reason}
              onValueChange={setReason}
              className="space-y-2"
            >
              {REASONS.map((r) => (
                <div key={r.id} className="flex items-center space-x-2.5 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <RadioGroupItem value={r.id} id={`reason-${r.id}`} />
                  <Label htmlFor={`reason-${r.id}`} className="text-xs font-normal cursor-pointer flex-1">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-feedback" className="text-xs font-semibold flex items-center gap-1.5">
              <HelpCircle size={13} className="text-muted-foreground" /> Additional Comments (Optional)
            </Label>
            <Textarea
              id="cancel-feedback"
              placeholder="Tell us what we could have done better..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Keep My Plan
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
