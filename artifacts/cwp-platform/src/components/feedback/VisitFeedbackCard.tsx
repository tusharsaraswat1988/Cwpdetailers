import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, CheckCircle2, MessageSquare, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { qualityApi } from "@/lib/quality/api";

const positiveTags = ["Great shine ✨", "Wheels clean", "Punctual timing", "Spotless glass", "Courteous cleaner"];
const negativeTags = ["Glass streaks", "Missed lower doors", "Arrived late", "Wheels skipped", "Water spots left"];

export type VisitFeedbackCardProps = {
  visitId: number;
  vehicleName?: string;
  visitDate?: string;
  onSubmitted?: () => void;
  onDismiss?: () => void;
};

export function VisitFeedbackCard({
  visitId,
  vehicleName,
  visitDate,
  onSubmitted,
  onDismiss,
}: VisitFeedbackCardProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const feedbackMutation = useMutation({
    mutationFn: () =>
      qualityApi.submitVisitFeedback(visitId, {
        ratingScore: rating,
        comment: comment.trim() || undefined,
        tags: selectedTags,
        issueReported: rating <= 2,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customer-pending-feedback"] });
      qc.invalidateQueries({ queryKey: ["customer-support-tickets"] });
      if (data.isNegative) {
        toast({
          title: "Feedback recorded",
          description: "Our field supervisor has been alerted to review and make this right.",
        });
      } else {
        toast({
          title: "Thank you for your rating!",
          description: "Your cleaner has been credited for your positive feedback.",
        });
      }
      onSubmitted?.();
    },
    onError: (err: any) => {
      toast({
        title: "Could not submit feedback",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const activeRating = hoverRating ?? rating;
  const isNegative = rating <= 2;
  const currentTags = rating >= 4 ? positiveTags : negativeTags;

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative space-y-3">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      )}

      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
            Recent Clean
          </Badge>
          <span className="text-xs text-muted-foreground">
            {visitDate ? new Date(visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Today"}
          </span>
        </div>
        <h4 className="text-sm font-semibold mt-1">
          How was the cleaning on {vehicleName || "your car"}?
        </h4>
      </div>

      {/* Interactive 5-Star Row */}
      <div className="flex items-center gap-1.5 py-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            onClick={() => {
              setRating(star);
              setIsExpanded(true);
            }}
            className="p-1 transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${star} star`}
          >
            <Star
              size={24}
              className={`${
                star <= activeRating
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
        <span className="text-xs font-medium ml-2 text-muted-foreground">
          {rating === 5
            ? "Excellent"
            : rating === 4
            ? "Good"
            : rating === 3
            ? "Average"
            : rating === 2
            ? "Needs Work"
            : "Poor"}
        </span>
      </div>

      {/* Expanded quick tags & comment */}
      {isExpanded && (
        <div className="space-y-3 pt-1 border-t animate-in fade-in-50">
          <div className="flex flex-wrap gap-1.5 pt-1">
            {currentTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              isNegative
                ? "What can we do better? (streaks, spots, timing, etc.)"
                : "Leave a compliment or instruction for your cleaner..."
            }
            className="text-xs h-16 resize-none"
          />

          {isNegative && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1.5 bg-amber-500/10 p-2 rounded-lg">
              <AlertCircle size={13} className="flex-shrink-0" />
              Submitting low rating alerts our field supervisor to inspect and reclean if needed.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={feedbackMutation.isPending}
              onClick={() => feedbackMutation.mutate()}
              className="text-xs h-8 px-4"
            >
              {feedbackMutation.isPending ? "Submitting..." : "Send Feedback"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
