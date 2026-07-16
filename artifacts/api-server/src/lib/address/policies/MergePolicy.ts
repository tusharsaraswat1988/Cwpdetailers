import type { MergeDuplicateInput } from "../types";
import type { AddressPolicy, AddressPolicyContext } from "./types";
import { addressIdentityRepository } from "../repositories/AddressIdentityRepository";

export const mergePolicy: AddressPolicy<MergeDuplicateInput, { mergedInto: number; merged: number[] }> = {
  name: "MergePolicy",
  async execute(input) {
    for (const mergeId of input.mergeIdentityIds) {
      if (mergeId === input.keepIdentityId) continue;
      await addressIdentityRepository.markMerged(mergeId, input.keepIdentityId);
    }
    return { mergedInto: input.keepIdentityId, merged: input.mergeIdentityIds };
  },
};

export type SnapshotPolicyInput = {
  identityId: number;
  addressId: number;
  customerId: number;
};

export const snapshotPolicy: AddressPolicy<SnapshotPolicyInput, { allowed: boolean }> = {
  name: "SnapshotPolicy",
  async execute(input) {
    if (!input.identityId || !input.addressId) {
      return { allowed: false };
    }
    return { allowed: true };
  },
};
