import type { AddressIdentity, Address } from "@workspace/db";

export type AddressIdentityEntity = {
  id: number;
  customerId: number;
  canonicalPlaceId: string | null;
  canonicalLatitude: number | null;
  canonicalLongitude: number | null;
  fingerprint: string;
  status: string;
};

export type AddressRecordEntity = {
  id: number;
  identityId: number;
  customerId: number;
  version: number;
  nickname: string | null;
  addressType: string;
  formattedAddress: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  isDefault: boolean;
  verificationStatus: string;
  source: string;
  normalizedAddress: string | null;
  addressConfidenceScore?: number;
};

export function toIdentityEntity(row: AddressIdentity): AddressIdentityEntity {
  return {
    id: row.id,
    customerId: row.customerId,
    canonicalPlaceId: row.canonicalPlaceId,
    canonicalLatitude: row.canonicalLatitude,
    canonicalLongitude: row.canonicalLongitude,
    fingerprint: row.fingerprint,
    status: row.status,
  };
}

export function toAddressRecordEntity(
  row: Address,
  addressConfidenceScore?: number,
): AddressRecordEntity {
  return {
    id: row.id,
    identityId: row.identityId,
    customerId: row.customerId,
    version: row.version,
    nickname: row.nickname,
    addressType: row.addressType,
    formattedAddress: row.formattedAddress,
    postalCode: row.postalCode,
    latitude: row.latitude,
    longitude: row.longitude,
    placeId: row.placeId,
    isDefault: row.isDefault,
    verificationStatus: row.verificationStatus,
    source: row.source,
    normalizedAddress: row.normalizedAddress,
    addressConfidenceScore,
  };
}

export type AddressDomainEntity = {
  identity: AddressIdentityEntity;
  address: AddressRecordEntity;
};

export function toAddressDomainEntity(
  identity: AddressIdentity,
  address: Address,
  addressConfidenceScore?: number,
): AddressDomainEntity {
  return {
    identity: toIdentityEntity(identity),
    address: toAddressRecordEntity(address, addressConfidenceScore),
  };
}
