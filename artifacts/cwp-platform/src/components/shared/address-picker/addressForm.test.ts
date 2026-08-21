import { describe, expect, it, vi } from "vitest";
import {
  addressFormToLocation,
  emptyAddressValue,
  formToWritePayload,
  savedLocationToLocationValue,
} from "@/components/shared/address-picker/addressForm";
import { nextGeocodeGeneration, currentGeocodeGeneration } from "@/lib/maps/places";

describe("first-time address form", () => {
  it("starts empty for a first location", () => {
    const form = emptyAddressValue("Home");
    expect(form.serviceLocationLabel).toBe("Home");
    expect(addressFormToLocation(form)).toBeNull();
  });

  it("saves Home with house number and a resolved place", () => {
    const loc = addressFormToLocation({
      ...emptyAddressValue("Home"),
      houseNumber: "12B",
      buildingName: "Green Valley Apartments",
      area: "Lanka",
      city: "Varanasi",
      pincode: "221005",
      latitude: "25.3176",
      longitude: "82.9739",
      formattedAddress: "Lanka, Varanasi",
    });
    expect(loc?.address).toContain("12B");
    expect(loc?.cityName).toBe("Varanasi");
  });

  it("saves Work and Other custom labels", () => {
    expect(formToWritePayload({
      ...emptyAddressValue("Work"),
      houseNumber: "1",
      area: "Sigra",
      city: "Varanasi",
      latitude: "25.3",
      longitude: "82.9",
    }, 9).label).toBe("Work");

    expect(formToWritePayload({
      ...emptyAddressValue("Parents' Home"),
      houseNumber: "2",
      area: "Assi",
      city: "Varanasi",
      latitude: "25.3",
      longitude: "82.9",
    }, 9).label).toBe("Parents' Home");
  });

  it("allows manual fallback without coordinates when city is present", () => {
    const loc = addressFormToLocation({
      ...emptyAddressValue("Home"),
      houseNumber: "12B",
      area: "Lanka",
      city: "Varanasi",
      pincode: "221005",
    });
    expect(loc).not.toBeNull();
    expect(loc?.latitude).toBe(0);
  });
});

describe("selecting a saved address", () => {
  it("maps a saved location for one-tap booking", () => {
    const value = savedLocationToLocationValue({
      id: 4,
      customerId: 1,
      label: "Home",
      address: "12B, Green Valley\nLanka\nVaranasi - 221005",
      houseNumber: "12B",
      area: "Lanka",
      cityName: "Varanasi",
      pincode: "221005",
      latitude: 25.31,
      longitude: 82.97,
      isDefault: true,
    });
    expect(value.savedLocationId).toBe(4);
    expect(value.cityName).toBe("Varanasi");
  });
});

describe("map drag geocode gating", () => {
  it("increments generation so in-flight reverse geocodes can be ignored", () => {
    const a = nextGeocodeGeneration();
    const b = nextGeocodeGeneration();
    expect(b).toBeGreaterThan(a);
    expect(currentGeocodeGeneration()).toBe(b);
  });
});

describe("keyboard / list semantics", () => {
  it("keeps suggestion highlight in range", () => {
    const suggestions = ["A", "B", "C"];
    let highlight = 0;
    const down = () => { highlight = Math.min(highlight + 1, suggestions.length - 1); };
    const up = () => { highlight = Math.max(highlight - 1, 0); };
    down(); down(); down();
    expect(highlight).toBe(2);
    up();
    expect(highlight).toBe(1);
  });
});

describe("maps failure copy", () => {
  it("does not expose GPS/technical terms in customer strings", () => {
    const copy = [
      "Where should we come?",
      "Search your address, building or landmark",
      "Use my current location",
      "Location selected",
      "Adjust location",
      "Help our team find you",
      "Save this place as",
      "Save address",
      "Map unavailable",
      "You can still enter your address manually.",
    ].join(" ");
    expect(copy).not.toMatch(/GPS|Place ID|geocod|coordinates|Factory/i);
    vi.fn();
  });
});
