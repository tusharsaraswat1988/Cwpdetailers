/**
 * Timezone-aware Cron & Interval Schedule Calculator.
 * Supports standard 5-part cron syntax (minute, hour, day of month, month, day of week)
 * and interval expressions with configurable IANA timezones (defaults to Asia/Kolkata / IST).
 */

export interface ScheduleDefinition {
  scheduleType: "one_time" | "recurring_interval" | "recurring_cron" | string;
  cronExpression?: string | null;
  intervalSeconds?: number | null;
  timezone?: string | null;
  runAt?: Date | null;
}

/**
 * Get date parts in target timezone.
 */
export function getTimezoneDateParts(date: Date, timezone: string = "Asia/Kolkata"): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "narrow",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();
  let hour = date.getUTCHours();
  let minute = date.getUTCMinutes();
  let second = date.getUTCSeconds();

  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    else if (part.type === "month") month = parseInt(part.value, 10);
    else if (part.type === "day") day = parseInt(part.value, 10);
    else if (part.type === "hour") {
      const h = parseInt(part.value, 10);
      hour = h === 24 ? 0 : h;
    } else if (part.type === "minute") minute = parseInt(part.value, 10);
    else if (part.type === "second") second = parseInt(part.value, 10);
  }

  // Calculate day of week from year, month, day
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = targetDate.getUTCDay();

  return { year, month, day, hour, minute, second, dayOfWeek };
}

/**
 * Checks if a specific value matches a cron field pattern (e.g. *, 5, 1-5, * / 15, 1,3,5)
 */
function matchesCronField(pattern: string, val: number, min: number, max: number): boolean {
  if (pattern === "*") return true;

  const parts = pattern.split(",");
  for (const part of parts) {
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) continue;
      const start = range === "*" || range === "" ? min : parseInt(range, 10);
      if (val >= start && (val - start) % step === 0) return true;
    } else if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (val >= start && val <= end) return true;
    } else {
      const target = parseInt(part, 10);
      if (val === target) return true;
    }
  }

  return false;
}

/**
 * Computes next run timestamp for a cron expression in target timezone.
 */
export function computeNextCronDate(
  cronExpr: string,
  fromDate: Date = new Date(),
  timezone: string = "Asia/Kolkata",
): Date {
  const fields = cronExpr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression '${cronExpr}'. Expected 5 fields.`);
  }

  const [minPattern, hourPattern, domPattern, monthPattern, dowPattern] = fields;

  // Start from fromDate plus 1 minute, truncated to zero seconds
  let candidate = new Date(fromDate.getTime() + 60 * 1000);
  candidate.setUTCSeconds(0, 0);

  // Search forward up to 366 days (527,040 iterations max, with fast steps)
  const maxSearchTime = fromDate.getTime() + 366 * 24 * 60 * 60 * 1000;

  while (candidate.getTime() <= maxSearchTime) {
    const tz = getTimezoneDateParts(candidate, timezone);

    // 1. Month check (1-12)
    if (!matchesCronField(monthPattern, tz.month, 1, 12)) {
      // Advance to next month
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }

    // 2. Day of Month check (1-31)
    if (!matchesCronField(domPattern, tz.day, 1, 31)) {
      candidate = new Date(candidate.getTime() + 60 * 60 * 1000);
      continue;
    }

    // 3. Day of Week check (0-6)
    if (!matchesCronField(dowPattern, tz.dayOfWeek, 0, 6)) {
      candidate = new Date(candidate.getTime() + 60 * 60 * 1000);
      continue;
    }

    // 4. Hour check (0-23)
    if (!matchesCronField(hourPattern, tz.hour, 0, 23)) {
      candidate = new Date(candidate.getTime() + 60 * 1000);
      continue;
    }

    // 5. Minute check (0-59)
    if (!matchesCronField(minPattern, tz.minute, 0, 59)) {
      candidate = new Date(candidate.getTime() + 60 * 1000);
      continue;
    }

    // All match! Return candidate
    return candidate;
  }

  throw new Error(`Could not find next matching date for cron '${cronExpr}' within 1 year.`);
}

/**
 * Universal schedule calculator.
 */
export function computeNextRun(
  schedule: ScheduleDefinition,
  fromDate: Date = new Date(),
): Date | null {
  const timezone = schedule.timezone || "Asia/Kolkata";

  if (schedule.scheduleType === "one_time") {
    if (schedule.runAt && schedule.runAt.getTime() > fromDate.getTime()) {
      return schedule.runAt;
    }
    return null; // One-time job has already run or no runAt provided
  }

  if (schedule.scheduleType === "recurring_interval") {
    const seconds = schedule.intervalSeconds && schedule.intervalSeconds > 0
      ? schedule.intervalSeconds
      : 3600; // default 1 hour
    return new Date(fromDate.getTime() + seconds * 1000);
  }

  if (schedule.scheduleType === "recurring_cron") {
    if (!schedule.cronExpression) {
      throw new Error("Cron expression required for recurring_cron schedule type");
    }
    return computeNextCronDate(schedule.cronExpression, fromDate, timezone);
  }

  return null;
}
