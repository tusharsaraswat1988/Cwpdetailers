import { cn } from "@/lib/utils";
import { Clock, Info } from "lucide-react";
import type { AvailableSlot } from "@/lib/schedule-slots";

interface ScheduleTimeStepProps {
  slots: string[];
  slotDetails?: AvailableSlot[];
  selected: string;
  durationMinutes?: number;
  dateReason?: string;
  onSelect: (time: string) => void;
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hStr, mStr] = startTime.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const totalMinutes = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function ScheduleTimeStep({
  slots,
  slotDetails,
  selected,
  durationMinutes = 60,
  dateReason,
  onSelect,
}: ScheduleTimeStepProps) {
  if (slots.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground bg-slate-50/50"
        data-testid="schedule-error-no-slots"
      >
        <p className="font-semibold text-slate-700">No arrival slots left for this date.</p>
        {dateReason ? (
          <p className="text-amber-800 text-xs mt-1.5 font-medium">{dateReason}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Please choose another day from the calendar.</p>
        )}
      </div>
    );
  }

  const selectedEndTime = selected ? calculateEndTime(selected, durationMinutes) : null;

  return (
    <div className="space-y-4" data-testid="schedule-step-time">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-primary" />
          <span>Select an arrival time window</span>
        </div>
        {durationMinutes && (
          <span className="text-[11px] font-medium text-slate-500">
            Estimated duration: <span className="font-semibold text-slate-700">{durationMinutes} mins</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5">
        {slots.map((slot) => {
          const isSelected = selected === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onSelect(slot)}
              data-testid={`schedule-time-${slot}`}
              className={cn(
                "rounded-xl border min-h-[44px] py-2.5 px-2 text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer flex flex-col items-center justify-center",
                isSelected
                  ? "border-primary bg-primary text-white shadow-sm ring-2 ring-primary/20"
                  : "border-slate-200/90 bg-white text-foreground hover:border-primary/40 hover:bg-slate-50 shadow-[0_2px_8px_rgba(11,29,54,0.04)]",
              )}
            >
              <span>{slot}</span>
            </button>
          );
        })}
      </div>

      {selected && selectedEndTime && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-900 text-xs font-medium">
          <Info size={14} className="text-primary shrink-0" />
          <span>
            Arrival window at <strong>{selected}</strong> • Expected service completion by{" "}
            <strong>{selectedEndTime}</strong> ({durationMinutes} mins in multiples of 15 min).
          </span>
        </div>
      )}
    </div>
  );
}

export default ScheduleTimeStep;
