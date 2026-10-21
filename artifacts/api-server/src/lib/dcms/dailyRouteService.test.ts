import { describe, expect, it } from "vitest";
import {
  isValidCoordinate,
  resolveRouteStopDestination,
} from "./routeDestination";

describe("isValidCoordinate", () => {
  it("accepts valid geographic coordinates", () => {
    expect(isValidCoordinate(25.3176, 82.9739)).toBe(true);
    expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
  });

  it("rejects (0, 0) dummy/default coordinates", () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });

  it("rejects non-numeric and out-of-range values", () => {
    expect(isValidCoordinate(null, null)).toBe(false);
    expect(isValidCoordinate(undefined, 82.97)).toBe(false);
    expect(isValidCoordinate(NaN, 82.97)).toBe(false);
    expect(isValidCoordinate(Infinity, 82.97)).toBe(false);
    expect(isValidCoordinate(95, 82.97)).toBe(false); // lat > 90
    expect(isValidCoordinate(-95, 82.97)).toBe(false); // lat < -90
    expect(isValidCoordinate(25, 200)).toBe(false); // lng > 180
    expect(isValidCoordinate(25, -200)).toBe(false); // lng < -180
    expect(isValidCoordinate("25.31" as unknown as number, 82.97)).toBe(false);
  });
});

describe("resolveRouteStopDestination", () => {
  it("prefers valid customer-changed service location coordinates over legacy subscription coordinates", () => {
    const res = resolveRouteStopDestination({
      subLocation: {
        latitude: 25.1,
        longitude: 82.1,
        radiusMeters: 150,
      },
      serviceLocation: {
        latitude: 25.3176,
        longitude: 82.9739,
        address: "New Changed Villa, Sigra, Varanasi",
        label: "New Home",
      },
      vehicle: {
        serviceAddress: "Old Vehicle Addr",
        serviceLat: 25.0,
        serviceLng: 82.0,
      },
    });

    expect(res.destinationType).toBe("coordinates");
    expect(res.location).toEqual({
      latitude: 25.3176,
      longitude: 82.9739,
      radiusMeters: 150,
    });
    expect(res.address).toBe("New Changed Villa, Sigra, Varanasi");
    expect(res.locationLabel).toBe("New Home");
  });

  it("uses subscription location coordinates when service location has no coordinates", () => {
    const res = resolveRouteStopDestination({
      subLocation: {
        latitude: 25.35,
        longitude: 82.95,
        radiusMeters: 80,
      },
      serviceLocation: null,
      vehicle: {
        serviceAddress: "Flat 201, Shivala",
      },
      customer: {
        address: "Customer Fallback Addr",
      },
    });

    expect(res.destinationType).toBe("coordinates");
    expect(res.location).toEqual({
      latitude: 25.35,
      longitude: 82.95,
      radiusMeters: 80,
    });
    expect(res.address).toBe("Flat 201, Shivala");
  });

  it("falls back to vehicle saved coordinates when subscription and service location coordinates are missing", () => {
    const res = resolveRouteStopDestination({
      subLocation: null,
      serviceLocation: null,
      vehicle: {
        serviceLat: 25.32,
        serviceLng: 82.98,
        serviceAddress: "Vehicle Home Parking",
        locationLabel: "Parking Bay 4",
      },
    });

    expect(res.destinationType).toBe("coordinates");
    expect(res.location).toEqual({
      latitude: 25.32,
      longitude: 82.98,
      radiusMeters: 100,
    });
    expect(res.address).toBe("Vehicle Home Parking");
    expect(res.locationLabel).toBe("Parking Bay 4");
  });

  it("falls back to reliably saved service address when coordinates are completely unavailable", () => {
    const res = resolveRouteStopDestination({
      subLocation: {
        latitude: null,
        longitude: null,
      },
      serviceLocation: {
        latitude: null,
        longitude: null,
        address: "Tower 5, B-402, Green Valley Apartments, Varanasi",
        label: "Apartment",
      },
      vehicle: {
        serviceLat: 0,
        serviceLng: 0,
      },
      customer: {
        address: "Fallback Customer Addr",
      },
    });

    expect(res.destinationType).toBe("address");
    expect(res.location).toBeNull();
    expect(res.address).toBe("Tower 5, B-402, Green Valley Apartments, Varanasi");
    expect(res.locationLabel).toBe("Apartment");
  });

  it("returns missing status and never invents coordinates when neither coordinates nor address exist", () => {
    const res = resolveRouteStopDestination({
      subLocation: null,
      serviceLocation: null,
      vehicle: null,
      customer: {
        address: "   ",
        city: null,
      },
    });

    expect(res.destinationType).toBe("missing");
    expect(res.location).toBeNull();
    expect(res.address).toBeNull();
    expect(res.locationLabel).toBeNull();
  });
});
