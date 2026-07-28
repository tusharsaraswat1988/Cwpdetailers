/** Vehicle vs solar marketing personalization. */
export type Division = "vehicle" | "solar";

export const DIVISION_STORAGE_KEY = "cwp:division";

export const DIVISION_PATHS: Record<Division, string> = {
  vehicle: "/vehicle",
  solar: "/solar",
};

export function pathForDivision(division: Division): string {
  return DIVISION_PATHS[division];
}

export function divisionFromPath(path: string): Division | null {
  const normalized = path.split("?")[0]?.replace(/\/$/, "") || "/";
  if (normalized === "/vehicle") return "vehicle";
  if (normalized === "/solar") return "solar";
  return null;
}
