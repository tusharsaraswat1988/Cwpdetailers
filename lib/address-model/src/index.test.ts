import { describe, expect, it } from "vitest";
import {
  composeSavedAddress,
  parseComposedAddress,
  formatAddressLines,
  hasRequiredAddressParts,
  canSaveCustomerLocation,
  mapGoogleAddressComponents,
  isDuplicateSavedLocation,
} from "./index";

describe("address-model", () => {
  const sample = {
    houseNumber: "12B",
    buildingName: "Green Valley",
    area: "Shastri Nagar, Lanka",
    landmark: "Near BHU gate",
    pincode: "221005",
    city: "Varanasi",
  };

  it("composes master multiline format", () => {
    expect(composeSavedAddress(sample)).toBe(
      "12B, Green Valley\nShastri Nagar, Lanka\nLandmark: Near BHU gate\nVaranasi - 221005",
    );
  });

  it("round-trips composed address", () => {
    const composed = composeSavedAddress(sample);
    expect(parseComposedAddress(composed)).toEqual(sample);
  });

  it("formats display lines consistently", () => {
    expect(formatAddressLines(sample)).toHaveLength(4);
  });

  it("validates required parts", () => {
    expect(hasRequiredAddressParts(sample)).toBe(true);
    expect(hasRequiredAddressParts({ ...sample, area: "" })).toBe(false);
  });

  it("maps Google components instead of parsing the formatted string", () => {
    const mapped = mapGoogleAddressComponents([
      { long_name: "H-204", short_name: "H-204", types: ["premise"] },
      { long_name: "Lanka", short_name: "Lanka", types: ["sublocality_level_1"] },
      { long_name: "Varanasi", short_name: "Varanasi", types: ["locality"] },
      { long_name: "221005", short_name: "221005", types: ["postal_code"] },
    ], "Something else, Mumbai 400001");
    expect(mapped.city).toBe("Varanasi");
    expect(mapped.pincode).toBe("221005");
    expect(mapped.area).toContain("Lanka");
  });

  it("allows saving with house + area when GPS is present", () => {
    expect(canSaveCustomerLocation(
      { houseNumber: "12B", area: "Lanka", city: "" },
      { hasCoordinates: true },
    )).toBe(true);
  });

  it("does not treat different flats as duplicates", () => {
    expect(isDuplicateSavedLocation(
      { placeId: "p1", houseNumber: "12B" },
      { placeId: "p1", houseNumber: "14A" },
    )).toBe(false);
  });
});
