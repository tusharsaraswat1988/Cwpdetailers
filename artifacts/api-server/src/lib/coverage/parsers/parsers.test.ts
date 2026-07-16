import { describe, it, expect } from "vitest";
import { googleAddressParser } from "./GoogleAddressParser";
import { manualAddressParser } from "./ManualAddressParser";
import { compositeAddressParser, buildCoverageRequest } from "./index";

describe("Address parsers", () => {
  it("ManualAddressParser extracts PIN from text", () => {
    const parsed = manualAddressParser.parse({
      address: "Lanka, Varanasi 221005",
    });
    expect(parsed.postalCode).toBe("221005");
  });

  it("GoogleAddressParser extracts structured fields", () => {
    const parsed = googleAddressParser.parse({
      addressComponents: [
        { long_name: "221005", short_name: "221005", types: ["postal_code"] },
        { long_name: "Varanasi", short_name: "Varanasi", types: ["locality"] },
      ],
    });
    expect(parsed.postalCode).toBe("221005");
    expect(parsed.city).toBe("Varanasi");
  });

  it("CompositeAddressParser merges Google over manual", () => {
    const parsed = compositeAddressParser.parse({
      address: "Assi Ghat",
      addressComponents: [
        { long_name: "221005", short_name: "221005", types: ["postal_code"] },
      ],
    });
    expect(parsed.postalCode).toBe("221005");
  });

  it("buildCoverageRequest remains backward compatible", () => {
    const req = buildCoverageRequest({
      address: "Lanka 221005",
      locationLat: 25.28,
      locationLng: 82.99,
      citySlug: "varanasi",
    });
    expect(req.pincode).toBe("221005");
    expect(req.citySlug).toBe("varanasi");
  });
});
