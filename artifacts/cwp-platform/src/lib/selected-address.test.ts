import { describe, expect, it } from "vitest";
import {
  addressesMatch,
  collectAddressCandidates,
  resolveDefaultAddress,
  selectedToHomeAddress,
} from "@/lib/selected-address";

describe("resolveDefaultAddress", () => {
  it("auto-selects the only saved location", () => {
    const selected = resolveDefaultAddress({
      vehicles: [],
      solarSites: [],
      savedLocations: [{
        id: 1,
        label: "Home",
        address: "12 MG Road, Varanasi",
        latitude: 25.3176,
        longitude: 82.9739,
        isDefault: false,
      }],
    });
    expect(selected?.address).toBe("12 MG Road, Varanasi");
    expect(selected?.assetLabel).toBe("Home");
  });

  it("prefers the default when several addresses exist", () => {
    const selected = resolveDefaultAddress({
      vehicles: [],
      solarSites: [],
      savedLocations: [
        { id: 1, label: "Office", address: "Assi", latitude: 25.28, longitude: 82.95, isDefault: false },
        { id: 2, label: "Home", address: "Lanka", latitude: 25.31, longitude: 82.97, isDefault: true },
      ],
    });
    expect(selected?.address).toBe("Lanka");
    expect(selected?.assetLabel).toBe("Home");
  });

  it("uses the active plan vehicle address when no saved location exists", () => {
    const selected = resolveDefaultAddress({
      vehicles: [{
        id: 9,
        registrationNumber: "UP32AB1234",
        make: "Swift",
        serviceAddress: "C 12, Sigra",
        serviceLat: 25.32,
        serviceLng: 82.98,
      }],
      solarSites: [],
      planVehicleId: 9,
    });
    expect(selected?.address).toBe("C 12, Sigra");
    expect(selected?.assetId).toBe(9);
  });

  it("still shows a vehicle address when the map pin is missing", () => {
    const selected = resolveDefaultAddress({
      vehicles: [{ id: 1, registrationNumber: "UP32AB1234", serviceAddress: "Sigra House" }],
      solarSites: [],
    });
    expect(selected?.address).toBe("Sigra House");
    expect(selectedToHomeAddress(selected).complete).toBe(false);
  });

  it("auto-selects a single service location", () => {
    const selected = resolveDefaultAddress({
      vehicles: [],
      solarSites: [],
      serviceLocations: [{
        id: 3,
        label: "Primary",
        address: "Flat 4, BHU",
        city: "Varanasi",
        isDefault: true,
      }],
    });
    expect(selected?.address).toBe("Flat 4, BHU, Varanasi");
    expect(selected?.assetLabel).toBe("Primary");
  });

  it("uses the customer profile address as last resort", () => {
    const selected = resolveDefaultAddress({
      vehicles: [],
      solarSites: [],
      profileAddress: "Flat 2, BHU campus",
    });
    expect(selected?.address).toBe("Flat 2, BHU campus");
  });

  it("dedupes the same address coming from saved + service location", () => {
    const candidates = collectAddressCandidates({
      vehicles: [],
      solarSites: [],
      savedLocations: [{
        id: 1, label: "Home", address: "12 MG Road", latitude: 25.3, longitude: 82.9, isDefault: true,
      }],
      serviceLocations: [{
        id: 8, label: "Primary", address: "12 MG Road", latitude: 25.3, longitude: 82.9, isDefault: true,
      }],
    });
    expect(candidates).toHaveLength(1);
  });
});

describe("selectedToHomeAddress", () => {
  it("shows the real address, not an add-asset prompt", () => {
    const view = selectedToHomeAddress({
      address: "12 MG Road",
      latitude: 25.3,
      longitude: 82.9,
      assetLabel: "Home",
    });
    expect(view.line).toBe("12 MG Road");
    expect(view.complete).toBe(true);
  });

  it("asks for a location when none is known", () => {
    const view = selectedToHomeAddress(null);
    expect(view.line).toBe("Add where we should arrive");
    expect(view.complete).toBe(false);
    expect(view.line.toLowerCase()).not.toContain("vehicle");
  });
});

describe("addressesMatch", () => {
  it("matches by pin when both have coordinates", () => {
    expect(addressesMatch(
      { address: "A", latitude: 25.3, longitude: 82.9 },
      { address: "B", latitude: 25.3, longitude: 82.9 },
    )).toBe(true);
  });

  it("matches by address text when pin is missing", () => {
    expect(addressesMatch(
      { address: "12 MG Road", latitude: 0, longitude: 0 },
      { address: "12  MG road", latitude: 0, longitude: 0 },
    )).toBe(true);
  });
});
