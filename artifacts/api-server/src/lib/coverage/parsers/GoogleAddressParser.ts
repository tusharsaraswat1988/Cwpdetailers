import type { CoverageRequest } from "../CoverageTypes";
import type { AddressParser } from "./AddressParser";
import { componentValue } from "./AddressParser";

export class GoogleAddressParser implements AddressParser {
  readonly providerId = "google";

  canParse(request: CoverageRequest): boolean {
    return Array.isArray(request.addressComponents) && request.addressComponents.length > 0;
  }

  parse(request: CoverageRequest) {
    const components = request.addressComponents ?? [];
    const postalCode = componentValue(components, "postal_code");
    const subLocality = componentValue(
      components,
      "sublocality_level_1",
      "sublocality_level_2",
      "sublocality",
    );
    const locality = componentValue(components, "locality", "postal_town");
    const adminCity = componentValue(components, "administrative_area_level_2");
    const city = locality ?? adminCity;
    const state = componentValue(components, "administrative_area_level_1");
    const country = componentValue(components, "country");

    return {
      postalCode: postalCode ?? request.postalCode ?? request.pincode ?? null,
      locality,
      subLocality,
      city,
      state,
      country,
    };
  }
}

export const googleAddressParser = new GoogleAddressParser();
