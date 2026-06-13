import { useState } from "react";
import { useSubmitVisitFeedback } from "../api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ThumbsDown, ThumbsUp } from "lucide-react";

type Props = {
  visitId: number;
  onSubmitted?: () => void;
};

export function CustomerVisitFeedback({ visitId, onSubmitted }: Props) {
  const { toast } = useToast();
  const submit = useSubmitVisitFeedback();
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  const handle = async (rating: "yes" | "no") => {
    try {
      await submit.mutateAsync({ visitId, rating, comment: comment || undefined });
      setDone(true);
      onSubmitted?.();
      toast({ title: "Thank you for your feedback" });
    } catch (e) {
      toast({ title: "Could not submit feedback", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (done) {
    return <p className="text-sm text-green-600">Feedback submitted — thank you!</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
      <p className="text-sm font-medium">Was today&apos;s cleaning completed properly?</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" disabled={submit.isPending} onClick={() => void handle("yes")}>
          <ThumbsUp className="h-4 w-4 mr-1" /> Yes
        </Button>
        <Button size="sm" variant="outline" className="flex-1" disabled={submit.isPending} onClick={() => void handle("no")}>
          <ThumbsDown className="h-4 w-4 mr-1" /> No
        </Button>
      </div>
      <Textarea
        placeholder="Optional comment"
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
        className="text-sm"
      />
    </div>
  );
}
