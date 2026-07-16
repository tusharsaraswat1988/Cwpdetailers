import type { CreateAddressInput } from "../types";
import type { AddressPolicy, AddressPolicyContext, NormalizationPolicyResult } from "./types";
import { prepareAddress } from "../domain/AddressPreparation";
import { mapGoogleComponents } from "../parsing/GoogleComponentMapper";

export const normalizationPolicy: AddressPolicy<CreateAddressInput, NormalizationPolicyResult> = {
  name: "NormalizationPolicy",
  async execute(input, ctx) {
    const prepared = ctx.prepared ?? prepareAddress(input);
    return { prepared };
  },
};

export const normalizationPolicyWithPreview = {
  preview(input: CreateAddressInput) {
    const prepared = prepareAddress(input);
    return {
      normalized: prepared.normalized,
      components: mapGoogleComponents(input.addressComponents),
      formattedAddress: prepared.formattedAddress,
    };
  },
};
