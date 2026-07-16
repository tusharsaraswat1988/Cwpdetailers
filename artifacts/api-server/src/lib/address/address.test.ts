import { describe, it, expect } from "vitest";
import {
  normalizeAddressFields,
  buildNormalizedAddressKey,
  buildFormattedAddressFromParts,
} from "./normalization/AddressNormalizer";
import { mapGoogleComponents, inferAddressSource } from "./parsing/GoogleComponentMapper";
import {
  buildAddressFingerprint,
  findDuplicateCandidates,
  distanceMeters,
} from "./deduplication/DeduplicationService";

describe("AddressNormalizer", () => {
  it("trims whitespace and duplicate commas", () => {
    const result = normalizeAddressFields({
      formattedAddress: "  12, , Main Road , Varanasi  ",
      postalCode: "221 005",
    });
    expect(result.formattedAddress).toBe("12, Main Road, Varanasi");
    expect(result.postalCode).toBe("221005");
  });

  it("builds consistent normalized keys", () => {
    const key = buildNormalizedAddressKey(
      normalizeAddressFields({
        houseNumber: "12",
        street: "Main Road",
        postalCode: "221005",
      }),
    );
    expect(key).toContain("12");
    expect(key).toContain("221005");
  });

  it("builds formatted address from parts", () => {
    const formatted = buildFormattedAddressFromParts(
      normalizeAddressFields({
        houseNumber: "12",
        street: "Main Road",
        locality: "Varanasi",
        postalCode: "221005",
        country: "India",
      }),
    );
    expect(formatted).toContain("Varanasi");
    expect(formatted).toContain("221005");
  });
});

describe("GoogleComponentMapper", () => {
  it("maps all useful Google components", () => {
    const mapped = mapGoogleComponents([
      { long_name: "12", short_name: "12", types: ["street_number"] },
      { long_name: "MG Road", short_name: "MG Road", types: ["route"] },
      { long_name: "221005", short_name: "221005", types: ["postal_code"] },
      { long_name: "Varanasi", short_name: "Varanasi", types: ["locality"] },
      { long_name: "Uttar Pradesh", short_name: "UP", types: ["administrative_area_level_1"] },
      { long_name: "India", short_name: "IN", types: ["country"] },
    ]);
    expect(mapped.houseNumber).toBe("12");
    expect(mapped.street).toBe("MG Road");
    expect(mapped.postalCode).toBe("221005");
    expect(mapped.locality).toBe("Varanasi");
  });

  it("infers GOOGLE source when placeId present", () => {
    expect(inferAddressSource({ placeId: "ChIJ123" })).toBe("GOOGLE");
    expect(inferAddressSource({ latitude: 25.3, longitude: 82.9 })).toBe("GPS");
    expect(inferAddressSource({})).toBe("MANUAL");
  });
});

describe("DeduplicationService", () => {
  it("uses placeId for fingerprint", () => {
    const a = buildAddressFingerprint({ placeId: "ChIJ123" });
    const b = buildAddressFingerprint({ placeId: "ChIJ123" });
    const c = buildAddressFingerprint({ placeId: "ChIJ999" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("detects duplicate by placeId", () => {
    const dupes = findDuplicateCandidates(
      {
        customerId: 1,
        placeId: "ChIJ123",
        normalizedFields: normalizeAddressFields({ formattedAddress: "Test" }),
      },
      [{
        identityId: 10,
        addressId: 20,
        placeId: "ChIJ123",
        fingerprint: "x",
      }],
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.reason).toBe("place_id");
  });

  it("detects proximity duplicates", () => {
    const normalized = buildNormalizedAddressKey(
      normalizeAddressFields({ formattedAddress: "Same place" }),
    );
    const dupes = findDuplicateCandidates(
      {
        customerId: 1,
        latitude: 25.3176,
        longitude: 82.9739,
        normalizedFields: normalizeAddressFields({ formattedAddress: "Same place" }),
      },
      [{
        identityId: 10,
        addressId: 20,
        latitude: 25.3177,
        longitude: 82.9740,
        normalizedAddress: normalized,
        fingerprint: "different-fingerprint",
      }],
      50,
    );
    expect(dupes.some(d => d.reason === "proximity")).toBe(true);
  });

  it("computes haversine distance", () => {
    const d = distanceMeters(25.3176, 82.9739, 25.3177, 82.9740);
    expect(d).toBeLessThan(20);
  });
});

describe("Address fingerprint stability", () => {
  it("rounds coordinates consistently", () => {
    const fp1 = buildAddressFingerprint({
      latitude: 25.317645,
      longitude: 82.973912,
      normalizedAddress: "12 main road|221005",
    });
    const fp2 = buildAddressFingerprint({
      latitude: 25.317646,
      longitude: 82.973913,
      normalizedAddress: "12 main road|221005",
    });
    expect(fp1).toBe(fp2);
  });
});
