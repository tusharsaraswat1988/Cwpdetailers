import { describe, expect, it } from "vitest";
import { canQueueOfflineOperation, isOfflineQueueAllowedType } from "./offlineQueuePolicy";
import { isOfflineQueued } from "./queuedResult";

describe("staff offline queue policy", () => {
  it("allows punch, job, visit, and photo types", () => {
    expect(isOfflineQueueAllowedType("staff_attendance")).toBe(true);
    expect(isOfflineQueueAllowedType("staff_job")).toBe(true);
    expect(isOfflineQueueAllowedType("staff_visit")).toBe(true);
    expect(isOfflineQueueAllowedType("staff_photo")).toBe(true);
    expect(canQueueOfflineOperation("staff_attendance", "/api/staff/1/attendance")).toBe(true);
    expect(canQueueOfflineOperation("staff_photo", "cwp://staff-photo")).toBe(true);
  });

  it("still blocks wallet writes", () => {
    expect(canQueueOfflineOperation("booking", "/api/wallet/credit")).toBe(false);
  });
});

describe("isOfflineQueued", () => {
  it("detects queued results", () => {
    expect(isOfflineQueued({ queued: true })).toBe(true);
    expect(isOfflineQueued({ queued: false })).toBe(false);
    expect(isOfflineQueued({ id: 1 })).toBe(false);
  });
});
