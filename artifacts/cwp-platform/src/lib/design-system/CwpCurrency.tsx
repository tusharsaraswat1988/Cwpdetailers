import React from "react";
import { cn } from "@/lib/utils";

export interface CwpCurrencyProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Numeric amount or numeric string (e.g. 1500, "1500.50") */
  value: number | string | null | undefined;
  /** Whether to show decimal digits. Default is auto (shown if fraction exists or if minFractionDigits > 0) */
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Optional tone: default (text-foreground), success (green), destructive (red), muted, primary */
  tone?: "default" | "success" | "destructive" | "muted" | "primary";
  /** Fallback string if value is null/undefined. Default "—" */
  fallback?: string;
  /** Show currency symbol. Default true ("₹") */
  showSymbol?: boolean;
}

/**
 * Format a number to Indian Rupee representation (e.g. ₹1,23,456.00)
 */
export function formatInr(
  value: number | string | null | undefined,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
    fallback?: string;
  }
): string {
  if (value == null || value === "") return options?.fallback ?? "—";
  const num = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(num)) return options?.fallback ?? "—";

  const minDigits = options?.minimumFractionDigits ?? (Number.isInteger(num) ? 0 : 2);
  const maxDigits = options?.maximumFractionDigits ?? 2;

  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });

  return options?.showSymbol !== false ? `₹${formatted}` : formatted;
}

/**
 * CWP Design System Currency Display Primitive
 * Strictly enforces `tabular-nums font-mono` for aligned numerical scanning across tables and ledgers.
 */
export const CwpCurrency = React.forwardRef<HTMLSpanElement, CwpCurrencyProps>(
  (
    {
      value,
      minimumFractionDigits,
      maximumFractionDigits,
      tone = "default",
      fallback = "—",
      showSymbol = true,
      className,
      ...props
    },
    ref
  ) => {
    const formatted = formatInr(value, {
      minimumFractionDigits,
      maximumFractionDigits,
      showSymbol,
      fallback,
    });

    const toneClasses = {
      default: "text-foreground",
      success: "text-emerald-600 dark:text-emerald-400 font-semibold",
      destructive: "text-rose-600 dark:text-rose-400 font-semibold",
      muted: "text-muted-foreground",
      primary: "text-primary font-semibold",
    }[tone];

    return (
      <span
        ref={ref}
        className={cn(
          "font-mono tabular-nums tracking-tight whitespace-nowrap",
          toneClasses,
          className
        )}
        data-testid="cwp-currency"
        {...props}
      >
        {formatted}
      </span>
    );
  }
);

CwpCurrency.displayName = "CwpCurrency";
