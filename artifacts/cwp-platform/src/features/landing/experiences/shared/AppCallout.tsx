import { Link } from "wouter";
import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppCalloutProps = {
  /** Unique line — do not repeat verified/RO claims here */
  message: string;
  href?: string;
  ctaLabel?: string;
  className?: string;
};

/** Lightweight app weave — used inside journey sections, not a standalone promo block. */
export function AppCallout({
  message,
  href = "/register",
  ctaLabel = "Open in app",
  className,
}: AppCalloutProps) {
  return (
    <div
      className={cn(
        "mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      data-testid="app-callout"
    >
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Smartphone
          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--landing-accent)]"
          aria-hidden
        />
        <span>{message}</span>
      </p>
      <Link
        href={href}
        className="shrink-0 text-sm font-semibold text-[color:var(--landing-accent)] hover:underline"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
