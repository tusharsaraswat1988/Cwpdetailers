import { Check } from "lucide-react";
import type { ScheduleStep } from "@/lib/schedule-journey";
import { cn } from "@/lib/utils";

const STEPS: { id: ScheduleStep; label: string }[] = [
  { id: "asset", label: "Asset" },
  { id: "plan", label: "Plan" },
  { id: "service", label: "Service" },
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "review", label: "Review" },
];

interface ScheduleStepProgressProps {
  step: ScheduleStep;
  hiddenSteps?: ScheduleStep[];
}

export function ScheduleStepProgress({ step, hiddenSteps = [] }: ScheduleStepProgressProps) {
  const visible = STEPS.filter(s => !hiddenSteps.includes(s.id));
  const activeIndex = visible.findIndex(s => s.id === step);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="schedule-step-progress" aria-label="Schedule progress">
      {visible.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={s.id} className="flex items-center gap-1 min-w-0 shrink-0">
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border",
                active && "border-primary bg-primary/10 text-primary",
                done && "border-green-500/40 bg-green-500/10 text-green-800",
                !active && !done && "border-border text-muted-foreground",
              )}
            >
              <span className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                active && "bg-primary text-secondary",
                done && "bg-green-600 text-white",
                !active && !done && "bg-muted",
              )}>
                {done ? <Check size={9} /> : i + 1}
              </span>
              <span>{s.label}</span>
            </div>
            {i < visible.length - 1 && (
              <div className={cn("h-px w-2", done ? "bg-green-500/50" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ScheduleStepProgress;
