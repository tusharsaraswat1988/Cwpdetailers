import { describe, expect, it } from "vitest";
import { resolveBookingAddressForEntry } from "@/lib/schedule-entry";

describe("booking saved address", () => {
  it("prefers the default saved location over an unbound stored pin", () => {
    const loc = resolveBookingAddressForEntry({
      asset: { id: 1, kind: "vehicle", name: "Swift", subtitle: "", location: {
        address: "Vehicle yard",
        latitude: 25.1,
        longitude: 82.1,
      } },
      selectedAddress: {
        address: "Home",
        latitude: 25.31,
        longitude: 82.97,
      },
    });
    expect(loc?.address).toBe("Home");
  });

  it("uses a saved location snapshot id for booking", () => {
    const loc = resolveBookingAddressForEntry({
      asset: null,
      savedLocations: [{
        id: 44,
        label: "Work",
        address: "Sigra, Varanasi",
        latitude: 25.3,
        longitude: 82.9,
        isDefault: true,
        cityName: "Varanasi",
      }],
    });
    expect(loc?.savedLocationId).toBe(44);
    expect(loc?.cityName).toBe("Varanasi");
  });
});
