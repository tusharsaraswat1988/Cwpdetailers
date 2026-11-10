import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface ScheduleTimeStepProps {
  slots: string[];
  selected: string;
  onSelect: (time: string) => void;
}

export function ScheduleTimeStep({ slots, selected, onSelect }: ScheduleTimeStepProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground bg-slate-50/50" data-testid="schedule-error-no-slots">
        No arrival slots left for this date. Please choose another day.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="schedule-step-time">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock size={14} className="text-primary" />
        <span>Select an arrival time window</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
        {slots.map(slot => {
          const isSelected = selected === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onSelect(slot)}
              data-testid={`schedule-time-${slot}`}
              className={cn(
                "rounded-xl border min-h-[48px] py-3 px-3 text-sm font-semibold transition-all duration-150 cursor-pointer",
                isSelected
                  ? "border-primary bg-primary text-white shadow-sm ring-2 ring-primary/20"
                  : "border-slate-200/90 bg-white text-foreground hover:border-primary/40 hover:bg-slate-50 shadow-[0_2px_8px_rgba(11,29,54,0.04)]",
              )}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ScheduleTimeStep;
