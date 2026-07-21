import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LANDING_LAYOUT } from "../../constants";
import { MarketingButton } from "./MarketingButton";

export type MarketingCTAProps = {
  title: string;
  description?: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
  children?: ReactNode;
};

export function MarketingCTA({
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  className,
  children,
}: MarketingCTAProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-4 border border-[color:var(--landing-accent)]/20 bg-[color:var(--landing-surface-tint)]/70 p-6 md:flex-row md:items-center md:p-8",
        LANDING_LAYOUT.sectionRadius,
        className,
      )}
    >
      <div className="max-w-xl">
        <p className="font-display text-lg font-bold text-foreground md:text-xl">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      <div className="flex flex-wrap gap-2">
        <MarketingButton href={primaryHref} variant="primary" size="md">
          {primaryLabel}
        </MarketingButton>
        {secondaryLabel && secondaryHref ? (
          <MarketingButton href={secondaryHref} variant="outline" size="md">
            {secondaryLabel}
          </MarketingButton>
        ) : null}
      </div>
    </div>
  );
}
