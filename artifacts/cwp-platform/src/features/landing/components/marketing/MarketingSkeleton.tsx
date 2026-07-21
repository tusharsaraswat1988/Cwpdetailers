import { cn } from "@/lib/utils";

export function MarketingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl bg-muted cwp-skeleton", className)}
      aria-hidden
    />
  );
}

export function MarketingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--landing-accent)] border-t-transparent",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
