import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HERO_SHADOW, LANDING_LAYOUT } from "../../constants";

export type MarketingCardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padded?: boolean;
};

export function MarketingCard({
  children,
  className,
  hover = false,
  padded = true,
}: MarketingCardProps) {
  return (
    <div
      className={cn(
        "border border-border bg-white",
        LANDING_LAYOUT.cardRadius,
        padded && "p-6 md:p-7",
        hover && cn("cwp-lift", HERO_SHADOW.optionActive),
        className,
      )}
    >
      {children}
    </div>
  );
}
