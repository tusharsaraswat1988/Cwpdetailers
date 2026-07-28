import { describe, expect, it } from "vitest";
import {
  composeSavedAddress,
  parseComposedAddress,
  formatAddressLines,
  hasRequiredAddressParts,
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
});
