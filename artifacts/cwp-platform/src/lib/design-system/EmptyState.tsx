import React from "react";
import { cn } from "@/lib/utils";
import { MaterialSymbol } from "./MaterialSymbol";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Standardized CWP Empty State Primitive
 * Eliminates unguided dashed boxes and replaces them with an encouraging, actionable surface.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-slate-200 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xs",
        className
      )}
      data-testid="cwp-empty-state"
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-xs">
        <MaterialSymbol name={icon} size={32} weight={400} />
      </div>

      <h3 className="font-display font-semibold text-slate-900 dark:text-white text-base sm:text-lg mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-xs active:scale-[0.98] min-h-11"
            >
              {action.icon && <MaterialSymbol name={action.icon} size={18} weight={500} />}
              <span>{action.label}</span>
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm transition-all min-h-11"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
