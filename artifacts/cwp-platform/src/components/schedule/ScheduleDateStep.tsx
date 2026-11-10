import type { ScheduleDateOption } from "@/lib/schedule-slots";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

interface ScheduleDateStepProps {
  dates: ScheduleDateOption[];
  selected: string;
  onSelect: (date: string) => void;
}

export function ScheduleDateStep({ dates, selected, onSelect }: ScheduleDateStepProps) {
  return (
    <div className="space-y-3" data-testid="schedule-step-date">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar size={14} className="text-primary" />
        <span>Select an available service date</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
        {dates.map(d => {
          const isSelected = selected === d.date && !d.disabled;
          return (
            <button
              key={d.date}
              type="button"
              disabled={d.disabled}
              onClick={() => !d.disabled && onSelect(d.date)}
              title={d.reason}
              data-testid={`schedule-date-${d.date}`}
              className={cn(
                "rounded-2xl border min-h-[72px] p-3.5 sm:p-4 text-left transition-all duration-150 cursor-pointer relative overflow-hidden flex flex-col justify-between",
                d.disabled && "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400",
                isSelected
                  ? "border-primary bg-primary text-white shadow-sm ring-2 ring-primary/20"
                  : !d.disabled && "border-slate-200/90 bg-white hover:border-primary/40 hover:bg-slate-50/80 shadow-[0_2px_8px_rgba(11,29,54,0.04)]",
              )}
            >
              <p className={cn("font-bold text-sm", isSelected ? "text-white" : "text-foreground")}>
                {d.label}
              </p>
              <p className={cn("text-xs mt-0.5 font-medium", isSelected ? "text-blue-100" : "text-muted-foreground")}>
                {d.date}
              </p>
              {d.disabled && d.reason && (
                <p className="text-[10px] text-amber-700 mt-1 font-medium leading-tight">{d.reason}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ScheduleDateStep;
