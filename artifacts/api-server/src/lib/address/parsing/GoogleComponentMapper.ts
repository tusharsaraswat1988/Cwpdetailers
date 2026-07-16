import type { GoogleAddressComponentInput } from "../types";

export type MappedGoogleComponents = {
  houseNumber?: string | null;
  buildingName?: string | null;
  street?: string | null;
  landmark?: string | null;
  area?: string | null;
  locality?: string | null;
  subLocality?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  plusCode?: string | null;
};

function pick(components: GoogleAddressComponentInput[], ...types: string[]): string | null {
  for (const type of types) {
    const match = components.find(c => c.types.includes(type));
    if (match?.long_name) return match.long_name;
  }
  return null;
}

/**
 * Persist ALL useful Google address components into structured fields.
 */
export function mapGoogleComponents(
  components: GoogleAddressComponentInput[] | null | undefined,
): MappedGoogleComponents {
  if (!components?.length) return {};

  const subLocality = pick(
    components,
    "sublocality_level_1",
    "sublocality_level_2",
    "sublocality",
    "neighborhood",
  );
  const locality = pick(components, "locality", "postal_town");
  const adminCity = pick(components, "administrative_area_level_2");
  const district = pick(components, "administrative_area_level_3");

  return {
    houseNumber: pick(components, "street_number", "premise"),
    buildingName: pick(components, "establishment", "point_of_interest", "premise"),
    street: pick(components, "route"),
    landmark: pick(components, "point_of_interest", "establishment"),
    area: subLocality ?? locality,
    locality: locality ?? adminCity,
    subLocality,
    district,
    state: pick(components, "administrative_area_level_1"),
    country: pick(components, "country"),
    postalCode: pick(components, "postal_code"),
    plusCode: pick(components, "plus_code"),
  };
}

export function inferVerificationFromSource(
  hasGoogle: boolean,
  hasGps: boolean,
  source?: string,
): "GOOGLE_VERIFIED" | "GPS_VERIFIED" | "USER_ENTERED" | "ADMIN_VERIFIED" | "UNKNOWN" {
  if (source === "ADMIN") return "ADMIN_VERIFIED";
  if (hasGoogle) return "GOOGLE_VERIFIED";
  if (hasGps) return "GPS_VERIFIED";
  if (source === "MANUAL" || source === "API") return "USER_ENTERED";
  return "UNKNOWN";
}

export function inferAddressSource(input: {
  addressComponents?: GoogleAddressComponentInput[] | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  explicitSource?: string | null;
}): "GOOGLE" | "GPS" | "MANUAL" | "IMPORTED" | "ADMIN" | "API" {
  if (input.explicitSource === "IMPORTED") return "IMPORTED";
  if (input.explicitSource === "ADMIN") return "ADMIN";
  if (input.explicitSource === "API") return "API";
  if (input.addressComponents?.length || input.placeId) return "GOOGLE";
  if (input.latitude != null && input.longitude != null) return "GPS";
  return "MANUAL";
}
