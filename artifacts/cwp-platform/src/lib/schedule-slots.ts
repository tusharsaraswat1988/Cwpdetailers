/** Customer-facing time slots — aligned with Booking Engine SlotService. */

export const SCHEDULE_TIME_SLOTS = [
  "08:00", "08:15", "08:30", "08:45",
  "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
  "12:00", "12:15", "12:30", "12:45",
  "14:00", "14:15", "14:30", "14:45",
  "15:00", "15:15", "15:30", "15:45",
  "16:00", "16:15", "16:30", "16:45",
  "17:00", "17:15", "17:30", "17:45",
  "18:00",
] as const;

export type ScheduleDateOption = {
  date: string;
  label: string;
  disabled: boolean;
  reason?: string;
  category?: string;
};

export type AvailableSlot = {
  time: string;
  available: boolean;
  remaining?: number;
  reason?: string;
  endsAt?: string;
};

export function formatLocalDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(y!, m! - 1, d!);
}

export function todayIso(now = new Date()): string {
  return formatLocalDateIso(now);
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
    const iso = formatLocalDateIso(d);
    const isSunday = d.getDay() === 0;
    options.push({
      date: iso,
      label: formatDateLabel(iso),
      disabled: isSunday,
      reason: isSunday ? "CWP is closed on Sundays (Weekly off)" : undefined,
      category: isSunday ? "weekly_off" : undefined,
    });
  }
  return options;
}

/**
 * Fetch dynamic calendar dates from backend operational calendar engine.
 * Falls back to static dates if offline or API error.
 */
export async function fetchCalendarDays(params: {
  count?: number;
  cityId?: number | null;
  branchId?: number | null;
  segment?: string;
}): Promise<ScheduleDateOption[]> {
  const qs = new URLSearchParams();
  if (params.count) qs.set("count", String(params.count));
  if (params.cityId != null) qs.set("cityId", String(params.cityId));
  if (params.branchId != null) qs.set("branchId", String(params.branchId));
  if (params.segment) qs.set("segment", params.segment);

  try {
    const res = await fetch(`/api/bookings/calendar-days?${qs.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error(`calendar-days HTTP ${res.status}`);
    const body = (await res.json()) as { days?: ScheduleDateOption[] };
    if (Array.isArray(body.days) && body.days.length > 0) return body.days;
  } catch {
    // fall through to local fallback
  }

  return buildAvailableDates(params.count ?? 14);
}

export function firstAvailableDate(dates: ScheduleDateOption[]): string | null {
  return dates.find((d) => !d.disabled)?.date ?? null;
}

/** Local fallback when slots API is unavailable. */
export function slotsForDate(dateStr: string, now = new Date()): string[] {
  const isToday = dateStr === todayIso(now);
  if (!isToday) return [...SCHEDULE_TIME_SLOTS];
  const currentHour = now.getHours();
  return SCHEDULE_TIME_SLOTS.filter((slot) => {
    const hour = parseInt(slot.split(":")[0] ?? "0", 10);
    return hour > currentHour;
  });
}

/**
 * Fetch server-side slot availability from Booking Engine with 15-minute variable duration.
 * Falls back to static slots if the API fails.
 */
export async function fetchAvailableSlots(params: {
  date: string;
  branchId?: number | null;
  cityId?: number | null;
  assetId?: number | null;
  serviceLocationId?: number | null;
  customerId?: number | null;
  durationMinutes?: number | null;
  segment?: string;
  stepMinutes?: number;
}): Promise<AvailableSlot[]> {
  const qs = new URLSearchParams({ date: params.date });
  if (params.branchId != null) qs.set("branchId", String(params.branchId));
  if (params.cityId != null) qs.set("cityId", String(params.cityId));
  if (params.assetId != null) qs.set("assetId", String(params.assetId));
  if (params.serviceLocationId != null) qs.set("serviceLocationId", String(params.serviceLocationId));
  if (params.customerId != null) qs.set("customerId", String(params.customerId));
  if (params.durationMinutes != null) qs.set("durationMinutes", String(params.durationMinutes));
  if (params.segment) qs.set("segment", params.segment);
  if (params.stepMinutes != null) qs.set("stepMinutes", String(params.stepMinutes));

  try {
    const res = await fetch(`/api/bookings/slots?${qs.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error(`slots HTTP ${res.status}`);
    const body = (await res.json()) as { slots?: AvailableSlot[] };
    if (Array.isArray(body.slots) && body.slots.length > 0) return body.slots;
  } catch {
    // fall through to static
  }

  return slotsForDate(params.date).map((time) => ({ time, available: true }));
}

export function availableTimesFromSlots(slots: AvailableSlot[]): string[] {
  return slots.filter((s) => s.available).map((s) => s.time);
}
