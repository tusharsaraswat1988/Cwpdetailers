/** Text normalization for address storage and deduplication. */

export type NormalizedAddressFields = {
  houseNumber?: string | null;
  buildingName?: string | null;
  floor?: string | null;
  apartment?: string | null;
  street?: string | null;
  landmark?: string | null;
  area?: string | null;
  locality?: string | null;
  subLocality?: string | null;
  district?: string | null;
  country?: string | null;
  postalCode?: string | null;
  formattedAddress?: string | null;
  plusCode?: string | null;
  nickname?: string | null;
};

function cleanText(value?: string | null): string | null {
  if (value == null) return null;
  let s = value.normalize("NFKC").trim();
  if (!s) return null;
  s = s.replace(/\s+/g, " ");
  s = s.replace(/,\s*,+/g, ", ");
  s = s.replace(/\s*,\s*/g, ", ");
  s = s.replace(/,\s*,+/g, ", ");
  s = s.replace(/^,\s*|,\s*$/g, "");
  return s || null;
}

function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .map(word => {
      if (!word) return word;
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeCase(value: string | null): string | null {
  if (!value) return null;
  if (value === value.toUpperCase() && value.length > 4) return titleCaseWords(value.toLowerCase());
  return value;
}

export function normalizeAddressFields(input: NormalizedAddressFields): NormalizedAddressFields {
  const formatted = cleanText(input.formattedAddress);
  return {
    houseNumber: normalizeCase(cleanText(input.houseNumber)),
    buildingName: normalizeCase(cleanText(input.buildingName)),
    floor: cleanText(input.floor),
    apartment: cleanText(input.apartment),
    street: normalizeCase(cleanText(input.street)),
    landmark: normalizeCase(cleanText(input.landmark)),
    area: normalizeCase(cleanText(input.area)),
    locality: normalizeCase(cleanText(input.locality)),
    subLocality: normalizeCase(cleanText(input.subLocality)),
    district: normalizeCase(cleanText(input.district)),
    country: normalizeCase(cleanText(input.country)) ?? "India",
    postalCode: cleanText(input.postalCode)?.replace(/\s/g, "") ?? null,
    plusCode: cleanText(input.plusCode)?.toUpperCase() ?? null,
    nickname: normalizeCase(cleanText(input.nickname)),
    formattedAddress: formatted ? normalizeCase(formatted) : null,
  };
}

export function buildNormalizedAddressKey(fields: NormalizedAddressFields): string {
  const parts = [
    fields.houseNumber,
    fields.buildingName,
    fields.floor,
    fields.apartment,
    fields.street,
    fields.landmark,
    fields.area,
    fields.locality,
    fields.subLocality,
    fields.district,
    fields.postalCode,
    fields.country,
  ]
    .filter(Boolean)
    .map(p => String(p).toLowerCase());

  if (parts.length === 0 && fields.formattedAddress) {
    return fields.formattedAddress.toLowerCase();
  }
  return parts.join("|");
}

export function buildFormattedAddressFromParts(fields: NormalizedAddressFields): string {
  if (fields.formattedAddress) return fields.formattedAddress;
  const segments = [
    [fields.houseNumber, fields.buildingName, fields.floor, fields.apartment].filter(Boolean).join(", "),
    fields.street,
    fields.landmark,
    fields.subLocality,
    fields.locality,
    fields.area,
    fields.district,
    fields.postalCode,
    fields.country,
  ].filter(Boolean);
  return segments.join(", ");
}
