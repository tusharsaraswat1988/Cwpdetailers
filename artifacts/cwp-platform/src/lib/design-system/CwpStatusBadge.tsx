import React from "react";
import { cn } from "@/lib/utils";
import { MaterialSymbol } from "./MaterialSymbol";
import { CWP_SEMANTIC } from "./tokens";

export type CwpStatusTone =
  | "completed"
  | "inProgress"
  | "enRoute"
  | "scheduled"
  | "pending"
  | "syncPending"
  | "cancelled"
  | "missed"
  | "draft";

export interface CwpStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: CwpStatusTone;
  label: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

/**
 * Standardized CWP Status Badge
 * Pair of accessible high-contrast text, color, and official Material Design 3 Symbol
 * Prevents color-only status ambiguity (WCAG 2.2 AA).
 */
export function CwpStatusBadge({
  tone,
  label,
  size = "md",
  showIcon = true,
  className,
  ...props
}: CwpStatusBadgeProps) {
  const config = CWP_SEMANTIC.color.status[tone] ?? CWP_SEMANTIC.color.status.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors",
        size === "sm"
          ? "px-2 py-0.5 text-[11px] leading-tight"
          : "px-2.5 py-1 text-xs leading-none",
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
      data-testid="cwp-status-badge"
      {...props}
    >
      {showIcon && (
        <MaterialSymbol
          name={config.icon}
          size={size === "sm" ? 14 : 16}
          weight={500}
          style={{ color: config.text }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
