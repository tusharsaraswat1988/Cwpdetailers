import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Apple HIG / MD3 grouped settings shell.
 * Soft surface, no outline card chrome — typography + spacing do the work.
 */
export function AccountSection({
  title,
  children,
  className,
  testId,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn("space-y-2", className)} data-testid={testId}>
      {title ? (
        <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div
        className={cn(
          "overflow-hidden rounded-[var(--customer-radius-lg,1.25rem)]",
          "bg-[color-mix(in_srgb,var(--customer-surface-tint)_42%,hsl(var(--card)))]",
          "divide-y divide-border/40",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Compact row inside a grouped section — 44px+ tap target. */
export function AccountRow({
  children,
  className,
  onClick,
  href,
  as: As = "div",
  testId,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  as?: "div" | "button";
  testId?: string;
}) {
  const classes = cn(
    "flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-left customer-transition",
    (onClick || href) && "hover:bg-foreground/[0.03] active:bg-foreground/[0.05]",
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes} data-testid={testId}>
        {children}
      </a>
    );
  }

  if (As === "button" || onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} data-testid={testId}>
        {children}
      </button>
    );
  }

  return (
    <div className={classes} data-testid={testId}>
      {children}
    </div>
  );
}

export function AccountTextAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("shrink-0 text-sm font-medium text-primary whitespace-nowrap", className)}>
      {children}
    </span>
  );
}
