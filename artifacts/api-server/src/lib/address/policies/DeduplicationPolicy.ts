import type { CreateAddressInput } from "../types";
import type { AddressPolicy, AddressPolicyContext, DeduplicationPolicyResult } from "./types";
import { findDuplicateCandidates } from "../deduplication/DeduplicationService";
import { addressRepository } from "../repositories/AddressRepository";

export const deduplicationPolicy: AddressPolicy<
  CreateAddressInput & { allowDuplicate?: boolean },
  DeduplicationPolicyResult
> = {
  name: "DeduplicationPolicy",
  async execute(input, ctx) {
    if (input.allowDuplicate) {
      return { duplicates: [], blocked: false };
    }
    if (!ctx.prepared) {
      throw new Error("DeduplicationPolicy requires prepared address in context");
    }
    const existing = await addressRepository.listDedupIndex(input.customerId);
    const duplicates = findDuplicateCandidates(
      {
        customerId: input.customerId,
        placeId: ctx.prepared.merged.placeId,
        latitude: ctx.prepared.merged.latitude,
        longitude: ctx.prepared.merged.longitude,
        normalizedFields: ctx.prepared.normalized,
      },
      existing,
    );
    return { duplicates, blocked: duplicates.length > 0 };
  },
};
