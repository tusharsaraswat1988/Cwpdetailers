import { buildCoverageRequest } from "../../coverage/parsers";
import { locationIntelligencePlatform } from "../../location-intelligence/LocationIntelligencePlatform";
import type { CreateAddressInput } from "../types";
import type { AddressPolicy, AddressPolicyContext, ValidationPolicyResult } from "./types";

export const validationPolicy: AddressPolicy<
  CreateAddressInput & { validateCoverage?: boolean },
  ValidationPolicyResult
> = {
  name: "ValidationPolicy",
  async execute(input, ctx) {
    if (input.validateCoverage === false) {
      return { success: true };
    }
    if (!ctx.prepared) {
      throw new Error("ValidationPolicy requires prepared address in context");
    }
    const prep = ctx.prepared;
    const coverage = await locationIntelligencePlatform.validateCoverage(
      buildCoverageRequest({
        customerId: input.customerId,
        address: prep.formattedAddress,
        locationLat: prep.merged.latitude,
        locationLng: prep.merged.longitude,
        placeId: prep.merged.placeId,
        postalCode: prep.normalized.postalCode,
        cityId: prep.merged.cityId,
        addressComponents: prep.merged.addressComponents as never,
        serviceId: input.serviceId,
      }),
      { requestSource: "address_validate", includeServiceCatalog: false },
      ctx.logger,
    );
    return {
      success: coverage.success,
      message: coverage.message,
      locationContext: coverage.locationContext as Record<string, unknown> | null,
      locationConfidenceScore: coverage.confidenceScore ?? coverage.locationContext?.confidenceScore ?? null,
      cityId: coverage.cityId ?? null,
    };
  },
};
