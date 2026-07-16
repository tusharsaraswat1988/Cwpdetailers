import type { CoverageRequest } from "../CoverageTypes";
import type { AddressParser } from "./AddressParser";
import { extractPincodeFromText } from "./AddressParser";

/** Parses address from free-text and explicit postal fields (no Google dependency). */
export class ManualAddressParser implements AddressParser {
  readonly providerId = "manual";

  canParse(_request: CoverageRequest): boolean {
    return true;
  }

  parse(request: CoverageRequest) {
    const explicit =
      (typeof request.postalCode === "string" && request.postalCode.trim())
      || (typeof request.pincode === "string" && request.pincode.trim())
      || null;

    const postalCode = explicit ?? extractPincodeFromText(request.address);

    return {
      postalCode,
      locality: null,
      subLocality: null,
      city: request.cityName ?? null,
      state: null,
      country: null,
    };
  }
}

export const manualAddressParser = new ManualAddressParser();
