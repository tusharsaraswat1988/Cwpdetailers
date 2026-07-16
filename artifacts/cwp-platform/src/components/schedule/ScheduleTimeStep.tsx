import { cn } from "@/lib/utils";

interface ScheduleTimeStepProps {
  slots: string[];
  selected: string;
  onSelect: (time: string) => void;
}

export function ScheduleTimeStep({ slots, selected, onSelect }: ScheduleTimeStepProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="schedule-error-no-slots">
        No time slots left for this date. Please pick another day.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="schedule-step-time">
      <p className="text-xs text-muted-foreground">Available arrival windows only.</p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map(slot => (
          <button
            key={slot}
            type="button"
            onClick={() => onSelect(slot)}
            data-testid={`schedule-time-${slot}`}
            className={cn(
              "rounded-lg border py-2.5 text-sm font-medium transition-all",
              selected === slot ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30",
            )}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ScheduleTimeStep;
