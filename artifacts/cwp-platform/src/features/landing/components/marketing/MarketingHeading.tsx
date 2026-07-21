import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MarketingHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
};

export function MarketingHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as = "h1",
  className,
}: MarketingHeadingProps) {
  const Tag = as;
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {eyebrow ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--landing-accent)]">
          {eyebrow}
        </p>
      ) : null}
      <Tag
        className={cn(
          "font-display font-bold tracking-tight text-foreground",
          as === "h1" && "text-3xl md:text-4xl",
          as === "h2" && "text-2xl md:text-3xl",
          as === "h3" && "text-xl md:text-2xl",
        )}
      >
        {title}
      </Tag>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-[17px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
