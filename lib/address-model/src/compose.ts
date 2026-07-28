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
