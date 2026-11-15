import { describe, it, expect } from "vitest";
import {
  CITY_COORDINATES,
  getCityCenterCoordinates,
} from "./ZoneMapPicker";

describe("ZoneMapPicker", () => {
  it("resolves Noida city center coordinates accurately", () => {
    const coords = getCityCenterCoordinates("Noida");
    expect(coords).toEqual([28.5355, 77.3910]);
  });

  it("resolves Varanasi city center coordinates accurately", () => {
    const coords = getCityCenterCoordinates("Varanasi");
    expect(coords).toEqual([25.3176, 82.9739]);
  });

  it("resolves Greater Noida city center coordinates", () => {
    const coords = getCityCenterCoordinates("Greater Noida");
    expect(coords).toEqual([28.4744, 77.5040]);
  });

  it("handles case-insensitivity and whitespace", () => {
    const coords = getCityCenterCoordinates("  vArAnAsI  ");
    expect(coords).toEqual([25.3176, 82.9739]);
  });

  it("falls back to Noida coordinates when city is unknown or undefined", () => {
    const coordsUndefined = getCityCenterCoordinates(undefined);
    expect(coordsUndefined).toEqual(CITY_COORDINATES.noida);

    const coordsUnknown = getCityCenterCoordinates("Random City XYZ");
    expect(coordsUnknown).toEqual(CITY_COORDINATES.noida);
  });
});
