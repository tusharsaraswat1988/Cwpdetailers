import { composeSavedAddress } from "./compose";
import { parseComposedAddress } from "./parse";
import type { CwpAddressDisplayInput, CwpServiceAddressParts } from "./types";

export function normalizeAddressParts(input: CwpAddressDisplayInput): CwpServiceAddressParts | null {
  if (input == null) return null;
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? parseComposedAddress(trimmed) : null;
  }
  if ("formattedAddress" in input) {
    const formatted = input.formattedAddress?.trim();
    if (!formatted) return null;
    const parts = parseComposedAddress(formatted);
    if (input.city?.trim() && !parts.city.trim()) {
      parts.city = input.city.trim();
    }
    return parts;
  }
  const hasContent = Object.values(input).some(v => String(v ?? "").trim());
  return hasContent ? input : null;
}

/** Multiline display lines — master format for UI cards and staff views. */
export function formatAddressLines(input: CwpAddressDisplayInput): string[] {
  const parts = normalizeAddressParts(input);
  if (!parts) return [];
  const composed = composeSavedAddress(parts);
  return composed.split("\n").filter(Boolean);
}

/** Single-line summary for compact chips (area + city). */
export function formatAddressSingleLine(input: CwpAddressDisplayInput): string {
  const parts = normalizeAddressParts(input);
  if (!parts) return "";
  const area = parts.area.trim();
  const city = parts.city.trim();
  if (area && city) return `${area}, ${city}`;
  return area || city || composeSavedAddress(parts).replace(/\n/g, ", ");
}

/** Staff navigation line — area first, then full composed address. */
export function formatStaffAddressLine(
  address: string | null | undefined,
  area?: string | null,
): string {
  const parts = normalizeAddressParts(address);
  const resolvedArea = area?.trim() || parts?.area.trim() || "";
  const composed = parts ? composeSavedAddress(parts) : address?.trim() ?? "";
  if (resolvedArea && composed && !composed.startsWith(resolvedArea)) {
    return `${resolvedArea}, ${composed.replace(/\n/g, ", ")}`;
  }
  return composed.replace(/\n/g, ", ");
}
