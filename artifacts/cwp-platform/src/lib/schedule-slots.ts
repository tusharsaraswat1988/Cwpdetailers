/** Customer-facing time slots — aligned with Booking Engine SlotService. */

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

export type AvailableSlot = {
  time: string;
  available: boolean;
  remaining?: number;
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
  return dates.find((d) => !d.disabled)?.date ?? null;
}

/** Local fallback when slots API is unavailable. */
export function slotsForDate(dateStr: string, now = new Date()): string[] {
  const isToday = dateStr === todayIso();
  if (!isToday) return [...SCHEDULE_TIME_SLOTS];
  const currentHour = now.getHours();
  return SCHEDULE_TIME_SLOTS.filter((slot) => {
    const hour = parseInt(slot.split(":")[0] ?? "0", 10);
    return hour > currentHour;
  });
}

/**
 * Fetch server-side slot availability from Booking Engine.
 * Falls back to static slots if the API fails.
 */
export async function fetchAvailableSlots(params: {
  date: string;
  branchId?: number | null;
  assetId?: number | null;
  serviceLocationId?: number | null;
  customerId?: number | null;
}): Promise<AvailableSlot[]> {
  const qs = new URLSearchParams({ date: params.date });
  if (params.branchId != null) qs.set("branchId", String(params.branchId));
  if (params.assetId != null) qs.set("assetId", String(params.assetId));
  if (params.serviceLocationId != null) qs.set("serviceLocationId", String(params.serviceLocationId));
  if (params.customerId != null) qs.set("customerId", String(params.customerId));

  try {
    const res = await fetch(`/api/bookings/slots?${qs.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error(`slots HTTP ${res.status}`);
    const body = await res.json() as { slots?: AvailableSlot[] };
    if (Array.isArray(body.slots) && body.slots.length > 0) return body.slots;
  } catch {
    // fall through to static
  }

  return slotsForDate(params.date).map((time) => ({ time, available: true }));
}

export function availableTimesFromSlots(slots: AvailableSlot[]): string[] {
  return slots.filter((s) => s.available).map((s) => s.time);
}
