import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MarketingContainer } from "./MarketingContainer";

export type MarketingSectionProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  containerClassName?: string;
  narrow?: boolean;
  tone?: "default" | "tint" | "white";
};

export function MarketingSection({
  children,
  id,
  className,
  containerClassName,
  narrow,
  tone = "default",
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-10 md:py-14",
        tone === "tint" && "bg-[color:var(--landing-surface-tint)]/40",
        tone === "white" && "bg-white",
        className,
      )}
    >
      <MarketingContainer narrow={narrow} className={containerClassName}>
        {children}
      </MarketingContainer>
    </section>
  );
}
