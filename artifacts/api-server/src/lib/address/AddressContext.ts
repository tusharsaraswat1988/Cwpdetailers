import type { AddressIdentity, Address, AddressVerificationStatus, AddressSource } from "@workspace/db";
import type { LocationContext } from "../location-intelligence/LocationContext";
import type { AddressHistoryEntity } from "../types";
import { ADDRESS_DOMAIN_VERSION } from "./versioning";
import type { AddressTraceContext } from "./correlation/AddressTraceContext";

export type AddressIdentitySummary = {
  id: number;
  customerId: number;
  canonicalPlaceId?: string | null;
  fingerprint: string;
  status: string;
};

export type AddressRecordSummary = {
  id: number;
  identityId: number;
  customerId: number;
  version: number;
  nickname?: string | null;
  addressType: string;
  formattedAddress?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  isDefault: boolean;
  verificationStatus: AddressVerificationStatus;
  source: AddressSource;
  normalizedAddress?: string | null;
};

export type AddressContext = {
  identity: AddressIdentitySummary;
  currentVersion: number;
  currentAddress: AddressRecordSummary;
  verification: {
    status: AddressVerificationStatus;
    source: AddressSource;
  };
  addressConfidenceScore: number;
  locationConfidenceScore?: number | null;
  isDefault: boolean;
  locationContext?: LocationContext | Record<string, unknown> | null;
  history?: AddressHistoryEntity[];
  snapshots?: Array<{ id: number; version: number; reason: string; createdAt: Date }>;
  correlation: AddressTraceContext;
  metadata: {
    version: typeof ADDRESS_DOMAIN_VERSION;
    [key: string]: unknown;
  };
};

export function buildAddressContext(input: {
  identity: AddressIdentity;
  address: Address;
  addressConfidenceScore: number;
  locationConfidenceScore?: number | null;
  correlation: AddressTraceContext;
  history?: AddressHistoryEntity[];
  snapshots?: Array<{ id: number; version: number; reason: string; createdAt: Date }>;
}): AddressContext {
  const locationCtx = input.address.locationContextSnapshot as LocationContext | null;
  return {
    identity: {
      id: input.identity.id,
      customerId: input.identity.customerId,
      canonicalPlaceId: input.identity.canonicalPlaceId,
      fingerprint: input.identity.fingerprint,
      status: input.identity.status,
    },
    currentVersion: input.address.version,
    currentAddress: {
      id: input.address.id,
      identityId: input.address.identityId,
      customerId: input.address.customerId,
      version: input.address.version,
      nickname: input.address.nickname,
      addressType: input.address.addressType,
      formattedAddress: input.address.formattedAddress,
      postalCode: input.address.postalCode,
      latitude: input.address.latitude,
      longitude: input.address.longitude,
      placeId: input.address.placeId,
      isDefault: input.address.isDefault,
      verificationStatus: input.address.verificationStatus,
      source: input.address.source,
      normalizedAddress: input.address.normalizedAddress,
    },
    verification: {
      status: input.address.verificationStatus,
      source: input.address.source,
    },
    addressConfidenceScore: input.addressConfidenceScore,
    locationConfidenceScore:
      input.locationConfidenceScore
      ?? locationCtx?.confidenceScore
      ?? input.address.confidenceScore,
    isDefault: input.address.isDefault,
    locationContext: locationCtx,
    history: input.history,
    snapshots: input.snapshots,
    correlation: input.correlation,
    metadata: {
      version: ADDRESS_DOMAIN_VERSION,
      addressOperationId: input.correlation.addressOperationId,
    },
  };
}
