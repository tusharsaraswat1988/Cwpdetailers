import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  addressesTable: {},
  addressIdentitiesTable: {},
  addressHistoryTable: {},
  addressSnapshotsTable: {},
  addressLegacyLinksTable: {},
}));

import { calculateAddressConfidence } from "./confidence/AddressConfidenceScorer";
import { prepareAddress } from "./domain/AddressPreparation";
import { buildAddressContext } from "./AddressContext";
import { buildAddressTraceContext } from "./correlation/AddressTraceContext";
import { addressDomainEventPublisher } from "./domain/events/EventPublisher";
import { ADDRESS_DOMAIN_VERSION, ADDRESS_CAPABILITY_VERSION } from "./versioning";
import { toAddressDomainEntity } from "./domain/entities";
import { createAddressPolicy, updateAddressPolicy } from "./policies/CreateAddressPolicy";
import { deduplicationPolicy } from "./policies/DeduplicationPolicy";
import { normalizationPolicyWithPreview } from "./policies/NormalizationPolicy";

describe("Address Confidence", () => {
  it("scores 100 for fully verified Google+GPS+parsed", () => {
    expect(calculateAddressConfidence({
      verificationStatus: "GOOGLE_VERIFIED",
      source: "GOOGLE",
      hasGoogleComponents: true,
      hasGps: true,
      hasParsedFields: true,
    })).toBe(100);
  });

  it("scores 90 for Google verified", () => {
    expect(calculateAddressConfidence({
      verificationStatus: "GOOGLE_VERIFIED",
      source: "GOOGLE",
      hasGoogleComponents: true,
      hasGps: false,
      hasParsedFields: true,
    })).toBe(90);
  });

  it("scores 25 for legacy migrated import", () => {
    expect(calculateAddressConfidence({
      verificationStatus: "UNKNOWN",
      source: "IMPORTED",
      hasGoogleComponents: false,
      hasGps: false,
      hasParsedFields: false,
      isLegacyMigrated: true,
    })).toBe(25);
  });

  it("scores 70 for manual entry", () => {
    expect(calculateAddressConfidence({
      verificationStatus: "USER_ENTERED",
      source: "MANUAL",
      hasGoogleComponents: false,
      hasGps: true,
      hasParsedFields: true,
    })).toBe(70);
  });
});

describe("AddressContext", () => {
  it("builds context with correlation and version", () => {
    const trace = buildAddressTraceContext({ requestId: "req-1", customerId: 5 });
    const ctx = buildAddressContext({
      identity: {
        id: 1,
        customerId: 5,
        canonicalPlaceId: "ChIJ",
        canonicalLatitude: 25.3,
        canonicalLongitude: 82.9,
        fingerprint: "abc",
        status: "ACTIVE",
        mergedIntoIdentityId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      address: {
        id: 10,
        identityId: 1,
        customerId: 5,
        version: 1,
        nickname: "Home",
        addressType: "HOME",
        formattedAddress: "Test",
        isDefault: true,
        verificationStatus: "GOOGLE_VERIFIED",
        source: "GOOGLE",
        confidenceScore: 90,
        isCurrent: true,
        country: "India",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
        houseNumber: null,
        buildingName: null,
        floor: null,
        apartment: null,
        street: null,
        landmark: null,
        area: null,
        locality: null,
        subLocality: null,
        cityId: null,
        district: null,
        stateId: null,
        postalCode: null,
        latitude: 25.3,
        longitude: 82.9,
        placeId: "ChIJ",
        plusCode: null,
        addressComponents: null,
        instructions: null,
        normalizedAddress: "test",
        locationContextSnapshot: null,
      },
      addressConfidenceScore: 90,
      correlation: trace,
    });
    expect(ctx.metadata.version).toBe(ADDRESS_DOMAIN_VERSION);
    expect(ctx.addressConfidenceScore).toBe(90);
    expect(ctx.correlation.addressOperationId).toBeTruthy();
  });
});

describe("Address Domain Events", () => {
  beforeEach(() => addressDomainEventPublisher.clearSubscribers());

  it("publishes to subscribers", () => {
    const received: string[] = [];
    addressDomainEventPublisher.subscribe(e => received.push(e.type));
    const trace = buildAddressTraceContext();
    addressDomainEventPublisher.publish({
      type: "AddressCreated",
      ...{
        timestamp: new Date().toISOString(),
        traceId: trace.traceId,
        requestId: trace.requestId,
        addressOperationId: trace.addressOperationId,
        version: ADDRESS_DOMAIN_VERSION,
      },
      addressContext: buildAddressContext({
        identity: { id: 1, customerId: 1, fingerprint: "x", status: "ACTIVE", canonicalPlaceId: null, canonicalLatitude: null, canonicalLongitude: null, mergedIntoIdentityId: null, createdAt: new Date(), updatedAt: new Date() },
        address: { id: 1, identityId: 1, customerId: 1, version: 1, nickname: null, addressType: "HOME", formattedAddress: "T", isDefault: false, verificationStatus: "UNKNOWN", source: "MANUAL", confidenceScore: null, isCurrent: true, country: "India", createdAt: new Date(), updatedAt: new Date(), deletedAt: null, archivedAt: null, houseNumber: null, buildingName: null, floor: null, apartment: null, street: null, landmark: null, area: null, locality: null, subLocality: null, cityId: null, district: null, stateId: null, postalCode: null, latitude: null, longitude: null, placeId: null, plusCode: null, addressComponents: null, instructions: null, normalizedAddress: null, locationContextSnapshot: null },
        addressConfidenceScore: 70,
        correlation: trace,
      }),
    });
    expect(received).toContain("AddressCreated");
  });
});

describe("Address Policies", () => {
  it("normalization policy prepares address once", () => {
    const prepared = prepareAddress({ customerId: 1, formattedAddress: "12 Main Road" });
    const result = normalizationPolicyWithPreview.preview({ customerId: 1, formattedAddress: "12 Main Road" });
    expect(result.formattedAddress).toContain("Main Road");
    expect(prepared.normalizedKey).toBeTruthy();
  });

  it("create and update policies exist", () => {
    expect(createAddressPolicy.name).toBe("CreateAddressPolicy");
    expect(updateAddressPolicy.name).toBe("UpdateAddressPolicy");
    expect(deduplicationPolicy.name).toBe("DeduplicationPolicy");
  });
});

describe("Address Versioning", () => {
  it("exports frozen version markers", () => {
    expect(ADDRESS_DOMAIN_VERSION).toBe("AddressDomainV1");
    expect(ADDRESS_CAPABILITY_VERSION).toBe("AddressCapabilityV1");
  });
});

describe("Address Domain Entities", () => {
  it("maps rows to domain entities", () => {
    const entity = toAddressDomainEntity(
      { id: 1, customerId: 5, canonicalPlaceId: null, canonicalLatitude: null, canonicalLongitude: null, fingerprint: "fp", status: "ACTIVE", mergedIntoIdentityId: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 10, identityId: 1, customerId: 5, version: 1, nickname: "Home", addressType: "HOME", formattedAddress: "Test", isDefault: true, verificationStatus: "GOOGLE_VERIFIED", source: "GOOGLE", confidenceScore: 90, isCurrent: true, country: "India", createdAt: new Date(), updatedAt: new Date(), deletedAt: null, archivedAt: null, houseNumber: null, buildingName: null, floor: null, apartment: null, street: null, landmark: null, area: null, locality: null, subLocality: null, cityId: null, district: null, stateId: null, postalCode: "221005", latitude: 25.3, longitude: 82.9, placeId: null, plusCode: null, addressComponents: null, instructions: null, normalizedAddress: "test", locationContextSnapshot: null },
      90,
    );
    expect(entity.address.addressConfidenceScore).toBe(90);
    expect(entity.identity.fingerprint).toBe("fp");
  });
});

describe("Address Preparation performance", () => {
  it("prepareAddress is idempotent for same input", () => {
    const input = { customerId: 1, formattedAddress: "12 Main Road, Varanasi", postalCode: "221005" };
    const a = prepareAddress(input);
    const b = prepareAddress(input);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.normalizedKey).toBe(b.normalizedKey);
  });
});
