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
};

export type CwpAddressDisplayInput =
  | CwpServiceAddressParts
  | { formattedAddress: string | null | undefined; city?: string | null }
  | string
  | null
  | undefined;
