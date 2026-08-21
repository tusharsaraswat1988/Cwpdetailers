import type { CwpServiceAddressParts } from "./types";

export function composeSavedAddress(parts: CwpServiceAddressParts): string {
  const lines: string[] = [];
  const unit = [parts.houseNumber.trim(), parts.buildingName.trim()].filter(Boolean).join(", ");
  if (unit) lines.push(unit);
  if (parts.area.trim()) lines.push(parts.area.trim());
  if (parts.landmark.trim()) lines.push(`Landmark: ${parts.landmark.trim()}`);
  const cityLine = [parts.city.trim(), parts.pincode.trim()].filter(Boolean).join(" - ");
  if (cityLine) lines.push(cityLine);
  return lines.join("\n");
}

export function hasRequiredAddressParts(
  parts: Pick<CwpServiceAddressParts, "houseNumber" | "area" | "city">,
): boolean {
  return Boolean(parts.houseNumber.trim() && parts.area.trim() && parts.city.trim());
}

export function hasFiniteCoordinates(lat?: number | null, lng?: number | null): boolean {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

/** Customer save-gate: house/flat + enough place detail. City required only when GPS/place is missing. */
export function canSaveCustomerLocation(
  parts: Pick<CwpServiceAddressParts, "houseNumber" | "area" | "city"> & {
    formattedAddress?: string | null;
  },
  opts?: { hasCoordinates?: boolean; mapsUnavailable?: boolean },
): boolean {
  if (!parts.houseNumber.trim()) return false;
  const hasPlace = Boolean(parts.area.trim() || parts.formattedAddress?.trim());
  if (!hasPlace) return false;
  if (opts?.mapsUnavailable || !opts?.hasCoordinates) {
    return Boolean(parts.city.trim());
  }
  return true;
}
