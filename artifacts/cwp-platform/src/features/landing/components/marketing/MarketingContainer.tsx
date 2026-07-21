import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LANDING_LAYOUT } from "../../constants";

export type MarketingContainerProps = {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
};

export function MarketingContainer({
  children,
  className,
  narrow = false,
}: MarketingContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        LANDING_LAYOUT.padX,
        narrow ? "max-w-3xl" : LANDING_LAYOUT.maxWidth,
        className,
      )}
    >
      {children}
    </div>
  );
}
