/** Google Places / Geocoder address component — captured directly, not parsed from formatted text. */
export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

/** CWP master service-address shape — used in admin, customer app, staff, and DB. */
export type CwpServiceAddressParts = {
  houseNumber: string;
  buildingName: string;
  area: string;
  landmark: string;
  pincode: string;
  city: string;
};

export type CwpServiceAddressInput = CwpServiceAddressParts & {
  serviceLocationLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  cityId?: number | null;
  formattedAddress?: string | null;
  googleComponents?: GoogleAddressComponent[] | null;
};

/** Canonical reusable customer service location (saved_locations). */
export type CanonicalSavedLocation = {
  id: number;
  customerId: number;
  label: string;
  houseNumber: string | null;
  buildingName: string | null;
  addressLine: string;
  area: string | null;
  landmark: string | null;
  cityId: number | null;
  cityName: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  isDefault: boolean;
  formattedAddress?: string | null;
  googleComponents?: GoogleAddressComponent[] | null;
};

export type CwpAddressDisplayInput =
  | CwpServiceAddressParts
  | { formattedAddress: string | null | undefined; city?: string | null }
  | string
  | null
  | undefined;
