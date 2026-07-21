import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LANDING_LAYOUT } from "../../constants";

export type MarketingBadgeProps = {
  children: ReactNode;
  className?: string;
  variant?: "accent" | "muted" | "outline";
};

export function MarketingBadge({
  children,
  className,
  variant = "accent",
}: MarketingBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        LANDING_LAYOUT.pillRadius,
        variant === "accent" &&
          "bg-[color:var(--landing-surface-tint)] text-[color:var(--landing-accent)]",
        variant === "muted" && "bg-muted text-muted-foreground",
        variant === "outline" && "border border-border bg-white text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
