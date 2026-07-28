import type { CwpServiceAddressParts } from "./types";

export function guessCityFromAddress(address: string): string | undefined {
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return undefined;
  for (let i = parts.length - 2; i >= 0; i--) {
    const p = parts[i]!;
    if (/^\d{5,6}/.test(p)) continue;
    if (/india/i.test(p)) continue;
    if (
      /pradesh|bengal|nadu|rashtra|gujarat|rajasthan|karnataka|kerala|bihar|odisha|punjab|haryana|delhi/i.test(p)
      && parts.length > 3
    ) {
      continue;
    }
    return p;
  }
  return parts[parts.length - 3] ?? parts[0];
}

/** Best-effort split of a Google formatted address into desk-friendly fields. */
export function prefillAddressFromGeocode(formatted: string): Partial<CwpServiceAddressParts> {
  const segments = formatted.split(",").map(s => s.trim()).filter(Boolean);
  const pincode = formatted.match(/\b(\d{6})\b/)?.[1] ?? "";
  const city = guessCityFromAddress(formatted) ?? "";

  const tailDrop = new Set<string>();
  if (segments.length > 0 && /^india$/i.test(segments[segments.length - 1]!)) {
    tailDrop.add(segments[segments.length - 1]!);
  }
  for (const seg of segments) {
    if (city && seg === city) tailDrop.add(seg);
    if (/\b\d{6}\b/.test(seg)) tailDrop.add(seg);
    if (
      /pradesh|nadu|rashtra|territory|delhi|bihar|gujarat|rajasthan|karnataka|kerala|punjab|haryana|odisha|bengal/i.test(seg)
      && seg.length > 4
    ) {
      tailDrop.add(seg);
    }
  }

  const core = segments.filter(s => !tailDrop.has(s));
  const houseNumber = core[0] ?? "";
  const buildingName = core.length > 2 ? (core[1] ?? "") : "";
  const areaStart = buildingName ? 2 : 1;
  const area = core.slice(areaStart).join(", ") || core[1] || formatted;

  return { houseNumber, buildingName, area, pincode, city };
}

const EMPTY_PARTS: CwpServiceAddressParts = {
  houseNumber: "",
  buildingName: "",
  area: "",
  landmark: "",
  pincode: "",
  city: "",
};

/** Parse a composed multiline address back into structured parts. */
export function parseComposedAddress(text: string | null | undefined): CwpServiceAddressParts {
  if (!text?.trim()) return { ...EMPTY_PARTS };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ...EMPTY_PARTS };

  const parts: CwpServiceAddressParts = { ...EMPTY_PARTS };

  let lineIdx = 0;
  const first = lines[lineIdx]!;
  if (first.includes(",")) {
    const [house, ...rest] = first.split(",").map(s => s.trim());
    parts.houseNumber = house ?? "";
    parts.buildingName = rest.join(", ");
  } else {
    parts.houseNumber = first;
  }
  lineIdx++;

  if (lineIdx < lines.length && !/^landmark:/i.test(lines[lineIdx]!) && !/^(.+)\s-\s(\d{6})$/.test(lines[lineIdx]!)) {
    parts.area = lines[lineIdx]!;
    lineIdx++;
  }

  if (lineIdx < lines.length && /^landmark:/i.test(lines[lineIdx]!)) {
    parts.landmark = lines[lineIdx]!.replace(/^landmark:\s*/i, "").trim();
    lineIdx++;
  }

  if (lineIdx < lines.length) {
    const cityMatch = lines[lineIdx]!.match(/^(.+?)\s-\s(\d{6})$/);
    if (cityMatch) {
      parts.city = cityMatch[1]!.trim();
      parts.pincode = cityMatch[2]!;
    } else {
      parts.city = lines[lineIdx]!;
    }
  }

  if (!parts.city && !parts.area && lines.length === 1) {
    const legacy = prefillAddressFromGeocode(text);
    return {
      houseNumber: legacy.houseNumber ?? "",
      buildingName: legacy.buildingName ?? "",
      area: legacy.area ?? text.trim(),
      landmark: "",
      pincode: legacy.pincode ?? "",
      city: legacy.city ?? "",
    };
  }

  return parts;
}
