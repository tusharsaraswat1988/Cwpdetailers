/**
 * Address Domain — public API.
 * Future modules must consume AddressCapability, not AddressService.
 */

export type {
  CreateAddressInput,
  UpdateAddressInput,
  AddressEntity,
  AddressHistoryEntity,
  AddressSnapshotEntity,
  DuplicateCandidate,
  MergeDuplicateInput,
  ParsedAddressPreview,
  GoogleAddressComponentInput,
} from "./types";

export {
  addressToPublicResponse,
  addressToSnapshotRecord,
  DEFAULT_DEDUP_DISTANCE_METERS,
} from "./types";

export {
  AddressCapability,
  addressCapability,
} from "./capability/AddressCapability";
export type { AddressCapabilityOptions } from "./capability/AddressCapability";

export type { AddressContext, AddressIdentitySummary, AddressRecordSummary } from "./AddressContext";
export { buildAddressContext } from "./AddressContext";

export { ADDRESS_DOMAIN_VERSION, ADDRESS_CAPABILITY_VERSION } from "./versioning";

export type { AddressTraceContext } from "./correlation/AddressTraceContext";
export {
  buildAddressTraceContext,
  resolveAddressTraceId,
  createAddressOperationId,
} from "./correlation/AddressTraceContext";

export { calculateAddressConfidence, calculateAddressConfidenceFromPrepared } from "./confidence/AddressConfidenceScorer";

export type { AddressDomainEvent, AddressDomainEventType } from "./domain/events/types";
export { addressDomainEventPublisher, AddressDomainEventPublisher } from "./domain/events/EventPublisher";

export type { AddressPolicy, AddressPolicyContext } from "./policies/types";
export { createAddressPolicy, updateAddressPolicy } from "./policies/CreateAddressPolicy";
export { deduplicationPolicy } from "./policies/DeduplicationPolicy";
export { validationPolicy } from "./policies/ValidationPolicy";
export { normalizationPolicy, normalizationPolicyWithPreview } from "./policies/NormalizationPolicy";
export { mergePolicy, snapshotPolicy } from "./policies/MergePolicy";

export type { AddressSearchCriteria, AddressSearchResult, AddressSearchProvider } from "./search/types";
export { repositoryAddressSearchProvider } from "./search/RepositorySearchProvider";

export type { AddressExtensionRegistry } from "./extensions/interfaces";
export { addressExtensionRegistry } from "./extensions/interfaces";

export type { AddressDomainEntity, AddressIdentityEntity, AddressRecordEntity } from "./domain/entities";
export { toAddressDomainEntity } from "./domain/entities";

export { prepareAddress } from "./domain/AddressPreparation";
export type { PreparedAddress } from "./domain/AddressPreparation";

export { buildAddressMetrics, emitAddressMetrics } from "./metrics/AddressMetrics";

export { AddressSnapshotService, addressSnapshotService, createBookingAddressSnapshot } from "./AddressSnapshotService";
export type { BookingSnapshotAnchor } from "./AddressSnapshotService";

export { LegacyAddressMigrator, legacyAddressMigrator } from "./migration/LegacyAddressMigrator";
export type { LegacyMigrationReport } from "./migration/LegacyAddressMigrator";

export { normalizeAddressFields, buildNormalizedAddressKey, buildFormattedAddressFromParts } from "./normalization/AddressNormalizer";
export { mapGoogleComponents, inferAddressSource, inferVerificationFromSource } from "./parsing/GoogleComponentMapper";
export { buildAddressFingerprint, findDuplicateCandidates, distanceMeters } from "./deduplication/DeduplicationService";

/** @deprecated Use addressCapability — internal implementation */
export {
  AddressService,
  addressService,
  AddressValidationError,
  AddressDuplicateError,
} from "./AddressService";

/** @deprecated Use addressCapability */
export { addressRepository } from "./repositories/AddressRepository";
export { addressIdentityRepository } from "./repositories/AddressIdentityRepository";
export { addressHistoryRepository } from "./repositories/AddressHistoryRepository";
export { addressSnapshotRepository } from "./repositories/AddressSnapshotRepository";
export { addressLegacyLinkRepository } from "./repositories/AddressLegacyLinkRepository";
