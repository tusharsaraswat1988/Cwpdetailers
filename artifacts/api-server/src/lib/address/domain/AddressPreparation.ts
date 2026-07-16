import type { AddressSource, AddressVerificationStatus } from "@workspace/db";
import type { CreateAddressInput } from "../types";
import {
  normalizeAddressFields,
  buildNormalizedAddressKey,
  buildFormattedAddressFromParts,
} from "../normalization/AddressNormalizer";
import {
  mapGoogleComponents,
  inferAddressSource,
  inferVerificationFromSource,
} from "../parsing/GoogleComponentMapper";
import { buildAddressFingerprint } from "../deduplication/DeduplicationService";

export type PreparedAddress = {
  merged: CreateAddressInput;
  normalized: ReturnType<typeof normalizeAddressFields>;
  formattedAddress: string;
  normalizedKey: string;
  source: AddressSource;
  verification: AddressVerificationStatus;
  fingerprint: string;
};

function mergeGoogleIntoInput(input: CreateAddressInput): CreateAddressInput {
  if (!input.addressComponents?.length) return input;
  const mapped = mapGoogleComponents(input.addressComponents);
  return {
    ...input,
    houseNumber: input.houseNumber ?? mapped.houseNumber,
    buildingName: input.buildingName ?? mapped.buildingName,
    street: input.street ?? mapped.street,
    landmark: input.landmark ?? mapped.landmark,
    area: input.area ?? mapped.area,
    locality: input.locality ?? mapped.locality,
    subLocality: input.subLocality ?? mapped.subLocality,
    district: input.district ?? mapped.district,
    postalCode: input.postalCode ?? mapped.postalCode,
    plusCode: input.plusCode ?? mapped.plusCode,
    country: input.country ?? mapped.country ?? "India",
  };
}

export function prepareAddress(input: CreateAddressInput): PreparedAddress {
  const merged = mergeGoogleIntoInput(input);
  const normalized = normalizeAddressFields({
    houseNumber: merged.houseNumber,
    buildingName: merged.buildingName,
    floor: merged.floor,
    apartment: merged.apartment,
    street: merged.street,
    landmark: merged.landmark,
    area: merged.area,
    locality: merged.locality,
    subLocality: merged.subLocality,
    district: merged.district,
    country: merged.country,
    postalCode: merged.postalCode,
    plusCode: merged.plusCode,
    nickname: merged.nickname,
    formattedAddress: merged.formattedAddress,
  });

  const formattedAddress = normalized.formattedAddress ?? buildFormattedAddressFromParts(normalized);
  const normalizedKey = buildNormalizedAddressKey(normalized);
  const source = inferAddressSource({
    addressComponents: merged.addressComponents,
    placeId: merged.placeId,
    latitude: merged.latitude,
    longitude: merged.longitude,
    explicitSource: merged.source ?? undefined,
  }) as AddressSource;

  const verification = inferVerificationFromSource(
    Boolean(merged.addressComponents?.length || merged.placeId),
    merged.latitude != null && merged.longitude != null,
    source,
  ) as AddressVerificationStatus;

  const fingerprint = buildAddressFingerprint({
    placeId: merged.placeId,
    latitude: merged.latitude,
    longitude: merged.longitude,
    normalizedAddress: normalizedKey,
  });

  return { merged, normalized, formattedAddress, normalizedKey, source, verification, fingerprint };
}
