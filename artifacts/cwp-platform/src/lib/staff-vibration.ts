/** Strong vibration pattern for new job alerts (PWA / mobile browsers). */
export const STAFF_JOB_VIBRATE_PATTERN = [120, 60, 120, 60, 280] as const;

export function vibrateStaffJobAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([...STAFF_JOB_VIBRATE_PATTERN]);
    } catch {
      // Some browsers block vibration outside user gesture — ignore.
    }
  }
}
