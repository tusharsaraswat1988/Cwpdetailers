export const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 0,
};

export const LOCATION_ACTION_LABELS: Record<string, string> = {
  attendance: "Shift check-in",
  en_route: "On my way",
  job_start: "Job started",
  job_complete: "Job completed",
};
