import { cn } from "@/lib/utils";

interface PlanProgressBarProps {
  used: number;
  total: number;
  label?: string;
  className?: string;
  showCounts?: boolean;
}

export function PlanProgressBar({
  used,
  total,
  label,
  className,
  showCounts = true,
}: PlanProgressBarProps) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || showCounts) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-semibold text-foreground font-display">{label}</span>}
          {showCounts && total > 0 && (
            <span className="text-muted-foreground font-mono tabular-nums text-[11px] font-medium">
              {remaining} / {total} Remaining
            </span>
          )}
        </div>
      )}
      <div
        className="h-2 rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label || "Service usage progress"}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showCounts && total > 0 && (
        <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
          {used} Used · {remaining} Remaining
        </p>
      )}
    </div>
  );
}

export default PlanProgressBar;
