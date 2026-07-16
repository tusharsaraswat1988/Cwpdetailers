/** Customer-facing time slots — aligned with booking WorkingHoursRule (06:00–22:00). */
export const SCHEDULE_TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "14:00", "15:00", "16:00", "17:00", "18:00",
] as const;

export type ScheduleDateOption = {
  date: string;
  label: string;
  disabled: boolean;
  reason?: string;
};

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDateLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const today = parseLocalDate(todayIso());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function buildAvailableDates(count = 14, fromDate = todayIso()): ScheduleDateOption[] {
  const start = parseLocalDate(fromDate);
  const options: ScheduleDateOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const isSunday = d.getDay() === 0;
    options.push({
      date: iso,
      label: formatDateLabel(iso),
      disabled: isSunday,
      reason: isSunday ? "CWP is closed on Sundays" : undefined,
    });
  }
  return options;
}

export function firstAvailableDate(dates: ScheduleDateOption[]): string | null {
  return dates.find(d => !d.disabled)?.date ?? null;
}

export function slotsForDate(dateStr: string, now = new Date()): string[] {
  const isToday = dateStr === todayIso();
  if (!isToday) return [...SCHEDULE_TIME_SLOTS];
  const currentHour = now.getHours();
  return SCHEDULE_TIME_SLOTS.filter(slot => {
    const hour = parseInt(slot.split(":")[0] ?? "0", 10);
    return hour > currentHour;
  });
}
