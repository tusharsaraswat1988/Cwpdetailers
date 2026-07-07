import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useLocationStore } from "./locationStore";
import { getStaffLocation } from "./getStaffLocation";
import {
  registerStaffGeolocationWatch,
  resetGeolocationCoordinatorForTests,
} from "./geolocationCoordinator";

describe("getStaffLocation", () => {
  const mockGetCurrentPosition = vi.fn();
  const suspendWatch = vi.fn();
  const resumeWatch = vi.fn();

  beforeEach(() => {
    resetGeolocationCoordinatorForTests();
    useLocationStore.getState().reset();
    registerStaffGeolocationWatch({ suspend: suspendWatch, resume: resumeWatch });
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    resetGeolocationCoordinatorForTests();
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
    expect(suspendWatch).not.toHaveBeenCalled();
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
    expect(suspendWatch).toHaveBeenCalledTimes(1);
    expect(resumeWatch).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent action reads", async () => {
    let active = 0;
    let maxActive = 0;

    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => {
        success({
          coords: { latitude: 25.31, longitude: 82.91, accuracy: 8 },
        } as GeolocationPosition);
        active -= 1;
      }, 10);
    });

    await Promise.all([getStaffLocation("action"), getStaffLocation("action")]);

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });
});
