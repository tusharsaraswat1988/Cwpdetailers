/** Sprint 2 feature gate — set ENABLE_SERVICE_LOCATIONS=false to roll back UI/API writes. */
export function isServiceLocationsEnabled(): boolean {
  const raw = process.env.ENABLE_SERVICE_LOCATIONS;
  if (raw === undefined || raw === "") return true;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}
