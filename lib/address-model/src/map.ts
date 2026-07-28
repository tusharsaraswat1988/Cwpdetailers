import { composeSavedAddress } from "./compose";
import type { CwpServiceAddressInput } from "./types";

/** Map CWP master address to POST /addresses (CreateAddressInput) body fields. */
export function toCreateAddressBody(input: CwpServiceAddressInput & { customerId: number }) {
  const formattedAddress = composeSavedAddress(input);
  const hasCoords = input.latitude != null && input.longitude != null;

  return {
    customerId: input.customerId,
    nickname: input.serviceLocationLabel?.trim() || null,
    addressType: "HOME" as const,
    houseNumber: input.houseNumber.trim() || null,
    buildingName: input.buildingName.trim() || null,
    area: input.area.trim() || null,
    landmark: input.landmark.trim() || null,
    locality: input.city.trim() || null,
    postalCode: input.pincode.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    placeId: input.placeId?.trim() || null,
    formattedAddress: formattedAddress || null,
    isDefault: true,
    source: hasCoords ? ("GOOGLE" as const) : ("MANUAL" as const),
    verificationStatus: hasCoords ? ("GOOGLE_VERIFIED" as const) : ("USER_ENTERED" as const),
    allowDuplicate: true,
    validateCoverage: false,
  };
}
