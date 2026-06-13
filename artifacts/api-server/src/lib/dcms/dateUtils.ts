/** IST date helpers shared across DCMS schedulers. */
export function todayStrInIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function dayBoundsIST(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(`${dateStr}T23:59:59+05:30`);
  return { start, end };
}

/** Weekly off: 1 = Sunday, 2 = Sat+Sun, etc. */
export function isWeeklyOffDay(dateStr: string, weeklyOffs: number): boolean {
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  const dow = d.getDay();
  if (weeklyOffs >= 1 && dow === 0) return true;
  if (weeklyOffs >= 2 && dow === 6) return true;
  return false;
}

export function isDateInPauseRange(
  dateStr: string,
  sub: { status: string; pauseStartDate?: string | null; pauseEndDate?: string | null },
): boolean {
  if (sub.status === "paused") return true;
  if (!sub.pauseStartDate || !sub.pauseEndDate) return false;
  return dateStr >= sub.pauseStartDate && dateStr <= sub.pauseEndDate;
}

export function getNext2359IST(now: Date): Date {
  const target = new Date(now);
  target.setUTCHours(18, 29, 0, 0);
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}
