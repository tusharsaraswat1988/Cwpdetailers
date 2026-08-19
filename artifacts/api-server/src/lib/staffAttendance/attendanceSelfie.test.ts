import { describe, expect, it } from "vitest";
import {
  AttendanceSelfieError,
  assertSelfCheckInSelfie,
  isDailyCleanOnlyStaff,
  isSelfCheckIn,
  selfCheckInProofRequired,
} from "./attendanceSelfie";

describe("staff attendance selfie", () => {
  it("requires a selfie only when staff mark their own present/late check-in", () => {
    expect(isSelfCheckIn({
      actorRole: "staff",
      actorStaffId: 7,
      targetStaffId: 7,
      status: "present",
    })).toBe(true);

    expect(isSelfCheckIn({
      actorRole: "staff",
      actorStaffId: 7,
      targetStaffId: 7,
      status: "late",
    })).toBe(true);

    expect(isSelfCheckIn({
      actorRole: "admin",
      actorStaffId: null,
      targetStaffId: 7,
      status: "present",
    })).toBe(false);

    expect(isSelfCheckIn({
      actorRole: "staff",
      actorStaffId: 7,
      targetStaffId: 7,
      status: "absent",
    })).toBe(false);
  });

  it("treats daily_car_cleaner-only staff as daily-clean-only", () => {
    expect(isDailyCleanOnlyStaff(["daily_car_cleaner"])).toBe(true);
    expect(isDailyCleanOnlyStaff(["daily_car_cleaner", "daily_car_cleaner"])).toBe(true);
    expect(isDailyCleanOnlyStaff(["daily_car_cleaner", "car_washer"])).toBe(false);
    expect(isDailyCleanOnlyStaff(["car_washer"])).toBe(false);
    expect(isDailyCleanOnlyStaff([])).toBe(false);
  });

  it("does not require selfie/GPS for daily-clean-only self check-in", () => {
    const self = {
      actorRole: "staff" as const,
      actorStaffId: 7,
      targetStaffId: 7,
      status: "present",
    };
    expect(selfCheckInProofRequired({ ...self, roleSlugs: ["daily_car_cleaner"] })).toBe(false);
    expect(selfCheckInProofRequired({ ...self, roleSlugs: ["daily_car_cleaner", "car_washer"] })).toBe(true);
    expect(selfCheckInProofRequired({ ...self, roleSlugs: ["car_washer"] })).toBe(true);
  });

  it("rejects missing selfie payload", () => {
    expect(() => assertSelfCheckInSelfie(undefined)).toThrow(AttendanceSelfieError);
    expect(() => assertSelfCheckInSelfie("  ")).toThrow(/Selfie photo is required/);
    expect(assertSelfCheckInSelfie("data:image/jpeg;base64,abc")).toContain("base64");
  });
});
