import type { ScheduleDateOption } from "@/lib/schedule-slots";
import { cn } from "@/lib/utils";

interface ScheduleDateStepProps {
  dates: ScheduleDateOption[];
  selected: string;
  onSelect: (date: string) => void;
}

export function ScheduleDateStep({ dates, selected, onSelect }: ScheduleDateStepProps) {
  return (
    <div className="space-y-2" data-testid="schedule-step-date">
      <p className="text-xs text-muted-foreground">Only available dates are selectable.</p>
      <div className="grid grid-cols-2 gap-2">
        {dates.map(d => (
          <button
            key={d.date}
            type="button"
            disabled={d.disabled}
            onClick={() => !d.disabled && onSelect(d.date)}
            title={d.reason}
            data-testid={`schedule-date-${d.date}`}
            className={cn(
              "rounded-xl border p-3 text-left text-sm transition-all",
              d.disabled && "opacity-40 cursor-not-allowed",
              selected === d.date && !d.disabled && "border-primary bg-primary/5",
              !d.disabled && selected !== d.date && "border-border hover:border-primary/30",
            )}
          >
            <p className="font-medium">{d.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{d.date}</p>
            {d.disabled && d.reason && (
              <p className="text-[10px] text-amber-700 mt-1">{d.reason}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ScheduleDateStep;
