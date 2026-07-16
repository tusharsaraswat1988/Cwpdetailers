import type {
  Address,
  AddressIdentity,
  AddressSnapshot,
  AddressType,
  AddressVerificationStatus,
  AddressSource,
} from "@workspace/db";

export type GoogleAddressComponentInput = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type CreateAddressInput = {
  customerId: number;
  nickname?: string | null;
  addressType?: AddressType;
  houseNumber?: string | null;
  buildingName?: string | null;
  floor?: string | null;
  apartment?: string | null;
  street?: string | null;
  landmark?: string | null;
  area?: string | null;
  locality?: string | null;
  subLocality?: string | null;
  cityId?: number | null;
  district?: string | null;
  stateId?: number | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  formattedAddress?: string | null;
  plusCode?: string | null;
  addressComponents?: GoogleAddressComponentInput[] | null;
  instructions?: string | null;
  isDefault?: boolean;
  verificationStatus?: AddressVerificationStatus;
  source?: AddressSource;
  /** Skip deduplication check */
  allowDuplicate?: boolean;
  /** Validate via Location Intelligence Platform */
  validateCoverage?: boolean;
  serviceId?: number | null;
};

export type UpdateAddressInput = Partial<Omit<CreateAddressInput, "customerId" | "allowDuplicate">> & {
  changeReason?: string;
};

export type AddressEntity = {
  identity: AddressIdentity;
  address: Address;
};

export type AddressHistoryEntity = {
  id: number;
  identityId: number;
  addressId: number;
  customerId: number;
  version: number;
  snapshot: Record<string, unknown>;
  changeReason?: string | null;
  supersededAt: Date;
  supersededByAddressId?: number | null;
};

export type AddressSnapshotEntity = {
  snapshot: AddressSnapshot;
  data: Record<string, unknown>;
};

export type DuplicateCandidate = {
  identityId: number;
  addressId: number;
  reason: "place_id" | "fingerprint" | "proximity";
  distanceMeters?: number;
};

export type MergeDuplicateInput = {
  customerId: number;
  keepIdentityId: number;
  mergeIdentityIds: number[];
};

export type ParsedAddressPreview = {
  normalized: ReturnType<typeof import("./normalization/AddressNormalizer").normalizeAddressFields>;
  components: ReturnType<typeof import("./parsing/GoogleComponentMapper").mapGoogleComponents>;
  formattedAddress: string;
};

export type AddressListFilter = {
  customerId: number;
  includeDeleted?: boolean;
  includeArchived?: boolean;
};

export const DEFAULT_DEDUP_DISTANCE_METERS = 50;

export function addressToSnapshotRecord(address: Address): Record<string, unknown> {
  return {
    id: address.id,
    identityId: address.identityId,
    customerId: address.customerId,
    version: address.version,
    nickname: address.nickname,
    addressType: address.addressType,
    houseNumber: address.houseNumber,
    buildingName: address.buildingName,
    floor: address.floor,
    apartment: address.apartment,
    street: address.street,
    landmark: address.landmark,
    area: address.area,
    locality: address.locality,
    subLocality: address.subLocality,
    cityId: address.cityId,
    district: address.district,
    stateId: address.stateId,
    country: address.country,
    postalCode: address.postalCode,
    latitude: address.latitude,
    longitude: address.longitude,
    placeId: address.placeId,
    formattedAddress: address.formattedAddress,
    plusCode: address.plusCode,
    addressComponents: address.addressComponents,
    instructions: address.instructions,
    normalizedAddress: address.normalizedAddress,
    isDefault: address.isDefault,
    verificationStatus: address.verificationStatus,
    source: address.source,
    confidenceScore: address.confidenceScore,
  };
}

export function addressToPublicResponse(entity: AddressEntity) {
  return {
    id: entity.address.id,
    identityId: entity.identity.id,
    customerId: entity.address.customerId,
    version: entity.address.version,
    nickname: entity.address.nickname,
    addressType: entity.address.addressType,
    houseNumber: entity.address.houseNumber,
    buildingName: entity.address.buildingName,
    floor: entity.address.floor,
    apartment: entity.address.apartment,
    street: entity.address.street,
    landmark: entity.address.landmark,
    area: entity.address.area,
    locality: entity.address.locality,
    subLocality: entity.address.subLocality,
    cityId: entity.address.cityId,
    district: entity.address.district,
    stateId: entity.address.stateId,
    country: entity.address.country,
    postalCode: entity.address.postalCode,
    latitude: entity.address.latitude,
    longitude: entity.address.longitude,
    placeId: entity.address.placeId,
    formattedAddress: entity.address.formattedAddress,
    plusCode: entity.address.plusCode,
    addressComponents: entity.address.addressComponents,
    instructions: entity.address.instructions,
    normalizedAddress: entity.address.normalizedAddress,
    isDefault: entity.address.isDefault,
    verificationStatus: entity.address.verificationStatus,
    source: entity.address.source,
    confidenceScore: entity.address.confidenceScore,
    locationContext: entity.address.locationContextSnapshot,
    createdAt: entity.address.createdAt,
    updatedAt: entity.address.updatedAt,
    deletedAt: entity.address.deletedAt,
    archivedAt: entity.address.archivedAt,
  };
}
