/** Fresh high-accuracy fix for attendance, jobs, photos, walk-in. */
export const GPS_ACTION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 0,
};

/** Stop waiting once accuracy is at or below this (field punch / geofence). */
export const GPS_TARGET_ACCURACY_METERS = 50;

/** Matches server MAX_GPS_ACCURACY_METERS — worse fixes are rejected. */
export const GPS_MAX_ACCURACY_METERS = 200;

/** Max time to wait for a better GPS fix on punch / job start / photos. */
export const GPS_ACCURACY_WAIT_MS = 15_000;

export const GPS_ACCURACY_POLL_MS = 2_000;

/** Cached / background reads — navigation and watchPosition updates. */
export const GPS_NAVIGATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 30_000,
};

/** Low-power foreground watch to keep cache warm. */
export const GPS_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 30_000,
};

/** @deprecated Use GPS_ACTION_OPTIONS */
export const GPS_OPTIONS = GPS_ACTION_OPTIONS;

/** Minimum gap between automatic background GPS refreshes (tab focus, etc.). */
export const GPS_RECHECK_INTERVAL_MS = 60_000;

/** Navigation cache TTL — matches maximumAge for nav reads. */
export const GPS_NAV_CACHE_MS = 30_000;

export const LOCATION_ACTION_LABELS: Record<string, string> = {
  attendance: "Shift check-in",
  en_route: "On my way",
  job_start: "Job started",
  job_complete: "Job completed",
};
