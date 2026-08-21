import { describe, expect, it } from "vitest";
import {
  canSaveCustomerLocation,
  isCoordinateNearPin,
  isDuplicateSavedLocation,
  mapGoogleAddressComponents,
} from "@workspace/address-model";
import { validateSavedLocationWrite } from "./validation";

describe("saved location duplicates", () => {
  it("treats same placeId and house number as a duplicate", () => {
    expect(isDuplicateSavedLocation(
      { placeId: "abc", houseNumber: "12B", latitude: 25.31, longitude: 82.97 },
      { placeId: "abc", houseNumber: "12B", latitude: 25.31, longitude: 82.97 },
    )).toBe(true);
  });

  it("does not merge different flats at the same placeId", () => {
    expect(isDuplicateSavedLocation(
      { placeId: "abc", houseNumber: "12B" },
      { placeId: "abc", houseNumber: "14A" },
    )).toBe(false);
  });

  it("matches very close coordinates with the same house number", () => {
    expect(isDuplicateSavedLocation(
      { houseNumber: "H-204", buildingName: "Green Valley", latitude: 25.31760, longitude: 82.97390 },
      { houseNumber: "H-204", buildingName: "Green Valley", latitude: 25.31761, longitude: 82.97391 },
    )).toBe(true);
  });

  it("does not merge distant coordinates", () => {
    expect(isDuplicateSavedLocation(
      { houseNumber: "12", latitude: 25.31, longitude: 82.97 },
      { houseNumber: "12", latitude: 19.07, longitude: 72.87 },
    )).toBe(false);
  });
});

describe("saved location validation", () => {
  it("requires a house number", () => {
    const err = validateSavedLocationWrite({
      customerId: 1,
      label: "Home",
      area: "Lanka",
      cityName: "Varanasi",
      latitude: 25.3,
      longitude: 82.9,
    });
    expect(err?.error).toMatch(/flat or house/i);
  });

  it("allows Google-resolved locations without a typed city", () => {
    expect(validateSavedLocationWrite({
      customerId: 1,
      label: "Home",
      houseNumber: "12B",
      area: "Lanka",
      latitude: 25.3,
      longitude: 82.9,
    })).toBeNull();
  });

  it("requires city when coordinates are missing", () => {
    const err = validateSavedLocationWrite({
      customerId: 1,
      label: "Home",
      houseNumber: "12B",
      area: "Lanka",
    });
    expect(err?.error).toMatch(/city/i);
  });
});

describe("customer save gate", () => {
  it("saves Home with house + area + coordinates", () => {
    expect(canSaveCustomerLocation(
      { houseNumber: "12B", area: "Lanka", city: "" },
      { hasCoordinates: true },
    )).toBe(true);
  });

  it("requires city in the manual fallback", () => {
    expect(canSaveCustomerLocation(
      { houseNumber: "12B", area: "Lanka", city: "" },
      { mapsUnavailable: true },
    )).toBe(false);
  });
});

describe("Google component mapping", () => {
  it("uses structured components instead of the formatted string", () => {
    const mapped = mapGoogleAddressComponents([
      { long_name: "12", short_name: "12", types: ["street_number"] },
      { long_name: "Green Valley", short_name: "Green Valley", types: ["premise"] },
      { long_name: "Lanka", short_name: "Lanka", types: ["sublocality_level_1"] },
      { long_name: "Varanasi", short_name: "Varanasi", types: ["locality"] },
      { long_name: "221005", short_name: "221005", types: ["postal_code"] },
    ], "ignored formatted blob, Mumbai 400001");
    expect(mapped.houseNumber).toBe("12");
    expect(mapped.area).toContain("Lanka");
    expect(mapped.city).toBe("Varanasi");
    expect(mapped.pincode).toBe("221005");
  });
});

describe("pin proximity", () => {
  it("rejects coordinates far from a known pin", () => {
    expect(isCoordinateNearPin(19.07, 72.87, 25.3176, 82.9739, 35)).toBe(false);
  });

  it("accepts coordinates near a known pin", () => {
    expect(isCoordinateNearPin(25.32, 82.97, 25.3176, 82.9739, 35)).toBe(true);
  });

  it("skips the check when the pin has no coordinates", () => {
    expect(isCoordinateNearPin(19.07, 72.87, null, null)).toBe(true);
  });
});
