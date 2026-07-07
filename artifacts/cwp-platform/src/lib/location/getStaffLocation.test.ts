import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useLocationStore } from "./locationStore";
import { getStaffLocation } from "./getStaffLocation";

describe("getStaffLocation", () => {
  const mockGetCurrentPosition = vi.fn();

  beforeEach(() => {
    useLocationStore.getState().reset();
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns cached coords for navigation mode without calling geolocation", async () => {
    useLocationStore.getState().setLocation({
      latitude: 25.3,
      longitude: 82.9,
      accuracy: 12,
    });

    const coords = await getStaffLocation("navigation");

    expect(coords.latitude).toBe(25.3);
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("always requests fresh coords for action mode", async () => {
    useLocationStore.getState().setLocation({
      latitude: 25.3,
      longitude: 82.9,
      accuracy: 12,
    });

    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 25.31, longitude: 82.91, accuracy: 8 },
      } as GeolocationPosition);
    });

    const coords = await getStaffLocation("action");

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(coords.latitude).toBe(25.31);
    expect(coords.accuracy).toBe(8);
  });
});
