import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildNavigateUrl, canNavigateTo, isValidMapCoordinate } from "./urls";
import { openExternalNavigation } from "./navigation";
import { Capacitor } from "@capacitor/core";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

describe("Map Navigation URL Construction", () => {
  it("constructs destination query with valid coordinates", () => {
    const url = buildNavigateUrl({
      latitude: 25.3176,
      longitude: 82.9739,
    });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=25.3176,82.9739");
  });

  it("constructs destination query with saved address when coordinates are missing", () => {
    const url = buildNavigateUrl({
      latitude: null,
      longitude: null,
      address: "123 Sigra, Varanasi, UP",
    });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=123%20Sigra%2C%20Varanasi%2C%20UP");
  });

  it("combines area and address when both present", () => {
    const url = buildNavigateUrl({
      area: "Sigra",
      address: "Lane 4, B-12",
    });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=Sigra%2C%20Lane%204%2C%20B-12");
  });

  it("returns null when neither coordinates nor address are available", () => {
    expect(buildNavigateUrl({})).toBeNull();
    expect(buildNavigateUrl({ latitude: 0, longitude: 0 })).toBeNull();
    expect(buildNavigateUrl({ address: "   " })).toBeNull();
  });

  it("validates coordinate boundaries accurately", () => {
    expect(isValidMapCoordinate(25.31, 82.97)).toBe(true);
    expect(isValidMapCoordinate(0, 0)).toBe(false);
    expect(isValidMapCoordinate(null, null)).toBe(false);
    expect(isValidMapCoordinate(95, 82)).toBe(false);
    expect(isValidMapCoordinate(25, 195)).toBe(false);
  });

  it("canNavigateTo reports readiness correctly", () => {
    expect(canNavigateTo({ latitude: 25.3, longitude: 82.9 })).toBe(true);
    expect(canNavigateTo({ address: "Sigra" })).toBe(true);
    expect(canNavigateTo({})).toBe(false);
    expect(canNavigateTo({ latitude: 0, longitude: 0 })).toBe(false);
  });
});

describe("openExternalNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens external URL in new tab on web platform", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const success = openExternalNavigation("https://www.google.com/maps/dir/?api=1&destination=25.3,82.9");
    expect(success).toBe(true);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://www.google.com/maps/dir/?api=1&destination=25.3,82.9",
      "_blank",
      "noopener,noreferrer",
    );

    windowOpenSpy.mockRestore();
  });

  it("opens with _system intent on native Capacitor Android platform", () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => ({} as Window));

    const success = openExternalNavigation("https://www.google.com/maps/dir/?api=1&destination=25.3,82.9");
    expect(success).toBe(true);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://www.google.com/maps/dir/?api=1&destination=25.3,82.9",
      "_system",
    );

    windowOpenSpy.mockRestore();
  });

  it("gracefully returns false for empty or null URL", () => {
    expect(openExternalNavigation(null)).toBe(false);
    expect(openExternalNavigation("")).toBe(false);
  });
});
