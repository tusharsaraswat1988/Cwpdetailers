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
          {label && <span className="font-medium text-foreground">{label}</span>}
          {showCounts && total > 0 && (
            <span className="text-muted-foreground tabular-nums">
              {remaining} / {total} Remaining
            </span>
          )}
        </div>
      )}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showCounts && total > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {used} Used · {remaining} Remaining
        </p>
      )}
    </div>
  );
}

export default PlanProgressBar;
