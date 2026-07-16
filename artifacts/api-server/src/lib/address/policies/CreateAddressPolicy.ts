import type { CreateAddressInput, UpdateAddressInput } from "../types";
import type { AddressPolicy, AddressPolicyContext } from "./types";
import { deduplicationPolicy } from "./DeduplicationPolicy";
import { validationPolicy } from "./ValidationPolicy";

export const createAddressPolicy: AddressPolicy<
  CreateAddressInput,
  { dedup: Awaited<ReturnType<typeof deduplicationPolicy.execute>>; validation: Awaited<ReturnType<typeof validationPolicy.execute>> }
> = {
  name: "CreateAddressPolicy",
  async execute(input, ctx) {
    const dedup = await deduplicationPolicy.execute(input, ctx);
    const validation = await validationPolicy.execute(input, ctx);
    return { dedup, validation };
  },
};

export const updateAddressPolicy: AddressPolicy<
  UpdateAddressInput & { validateCoverage?: boolean; customerId: number },
  Awaited<ReturnType<typeof validationPolicy.execute>> | { success: true }
> = {
  name: "UpdateAddressPolicy",
  async execute(input, ctx) {
    if (!input.validateCoverage) {
      return { success: true };
    }
    return validationPolicy.execute(
      { ...input, customerId: input.customerId } as CreateAddressInput,
      ctx,
    );
  },
};
