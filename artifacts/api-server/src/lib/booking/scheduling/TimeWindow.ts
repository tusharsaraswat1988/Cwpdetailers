/**
 * Canonical time window for Booking Engine.
 * Supports variable service duration — not fixed one-hour slots.
 */

/** Domain default when caller omits duration. Overridable per booking. */
export const DOMAIN_DEFAULT_DURATION_MINUTES = 60;

export type TimeWindowInput = {
  scheduledDate: string;
  scheduledTime?: string | null;
  /** Explicit start (ISO). Wins over date+time when provided. */
  scheduledStartAt?: Date | string | null;
  /** Explicit end (ISO). Wins over start+duration when provided. */
  scheduledEndAt?: Date | string | null;
  durationMinutes?: number | null;
};

export type ResolvedTimeWindow = {
  scheduledDate: string;
  scheduledTime: string | null;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  durationMinutes: number;
};

function parseTimeParts(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  const hour = parseInt(m[1]!, 10);
  const minute = parseInt(m[2]!, 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function toDate(value: Date | string): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid datetime: ${String(value)}`);
  return d;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve a booking time window from any supported input shape.
 */
export function resolveTimeWindow(input: TimeWindowInput): ResolvedTimeWindow {
  const durationMinutes = Math.max(
    1,
    input.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES,
  );

  let start: Date;
  if (input.scheduledStartAt) {
    start = toDate(input.scheduledStartAt);
  } else {
    const time = input.scheduledTime ? parseTimeParts(input.scheduledTime) : { hour: 9, minute: 0 };
    if (!time) throw new Error(`Invalid scheduledTime: ${input.scheduledTime}`);
    start = new Date(`${input.scheduledDate}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00`);
    if (Number.isNaN(start.getTime())) throw new Error(`Invalid scheduledDate: ${input.scheduledDate}`);
  }

  let end: Date;
  if (input.scheduledEndAt) {
    end = toDate(input.scheduledEndAt);
  } else {
    end = new Date(start.getTime() + durationMinutes * 60_000);
  }

  if (end.getTime() <= start.getTime()) {
    throw new Error("scheduledEndAt must be after scheduledStartAt");
  }

  const resolvedDuration = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 60_000),
  );

  return {
    scheduledDate: input.scheduledDate || formatDate(start),
    scheduledTime: input.scheduledTime ?? formatTime(start),
    scheduledStartAt: start,
    scheduledEndAt: end,
    durationMinutes: input.durationMinutes ?? resolvedDuration,
  };
}

/** True when two half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap. */
export function windowsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Generate candidate start times for discovery UI (not a capacity assumption). */
export function generateCandidateStarts(
  date: string,
  opts?: {
    fromHour?: number;
    toHour?: number;
    fromMinute?: number;
    toMinute?: number;
    stepMinutes?: number;
    skipLunchGap?: boolean;
  },
): string[] {
  const fromMinutes = (opts?.fromHour ?? 8) * 60 + (opts?.fromMinute ?? 0);
  const toMinutes = (opts?.toHour ?? 18) * 60 + (opts?.toMinute ?? 0);
  const step = opts?.stepMinutes ?? 15;
  const skipLunch = opts?.skipLunchGap ?? false;
  const slots: string[] = [];
  for (let minutes = fromMinutes; minutes < toMinutes; minutes += step) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (skipLunch && h >= 12 && h < 14) continue;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}
