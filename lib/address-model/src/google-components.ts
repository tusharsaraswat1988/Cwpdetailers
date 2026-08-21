import type { CwpServiceAddressParts, GoogleAddressComponent } from "./types";
import { prefillAddressFromGeocode } from "./parse";

function pick(components: GoogleAddressComponent[], ...types: string[]): string {
  for (const type of types) {
    const match = components.find(c => c.types.includes(type));
    if (match?.long_name?.trim()) return match.long_name.trim();
  }
  return "";
}

/**
 * Map Google address_components into CWP fields.
 * Formatted address is display/fallback only — never the primary parser.
 */
export function mapGoogleAddressComponents(
  components: GoogleAddressComponent[] | null | undefined,
  formattedAddress?: string | null,
): Partial<CwpServiceAddressParts> {
  if (!components?.length) {
    return formattedAddress ? prefillAddressFromGeocode(formattedAddress) : {};
  }

  const subLocality = pick(
    components,
    "sublocality_level_1",
    "sublocality_level_2",
    "sublocality",
    "neighborhood",
  );
  const locality = pick(components, "locality", "postal_town");
  const adminCity = pick(components, "administrative_area_level_2");
  const route = pick(components, "route");
  const premise = pick(components, "premise");
  const streetNumber = pick(components, "street_number");
  const establishment = pick(components, "establishment", "point_of_interest");
  const postalCode = pick(components, "postal_code");

  const houseNumber = streetNumber || premise;
  const buildingName = establishment && establishment !== premise ? establishment : (premise && streetNumber ? premise : "");
  const area = [route, subLocality].filter(Boolean).join(", ") || subLocality || locality;
  const city = locality || adminCity;

  const mapped: Partial<CwpServiceAddressParts> = {
    houseNumber: houseNumber || undefined,
    buildingName: buildingName || undefined,
    area: area || undefined,
    pincode: postalCode || undefined,
    city: city || undefined,
  };

  if (!mapped.houseNumber && formattedAddress) {
    const fallback = prefillAddressFromGeocode(formattedAddress);
    if (!mapped.houseNumber) mapped.houseNumber = fallback.houseNumber;
    if (!mapped.buildingName) mapped.buildingName = fallback.buildingName;
    if (!mapped.area) mapped.area = fallback.area;
    if (!mapped.city) mapped.city = fallback.city;
    if (!mapped.pincode) mapped.pincode = fallback.pincode;
  }

  return mapped;
}

export function mergeGooglePrefill(
  current: Partial<CwpServiceAddressParts>,
  mapped: Partial<CwpServiceAddressParts>,
): Partial<CwpServiceAddressParts> {
  const take = (key: keyof CwpServiceAddressParts) => {
    const existing = (current[key] ?? "").trim();
    const next = (mapped[key] ?? "").trim();
    return existing || next || "";
  };
  return {
    houseNumber: take("houseNumber"),
    buildingName: take("buildingName"),
    area: take("area"),
    landmark: take("landmark"),
    pincode: take("pincode"),
    city: take("city"),
  };
}
