import { describe, expect, it } from "vitest";
import { isStaffNativeAllowedPath, isStaffNativeApp, staffNativeHomePath } from "./staffNative";

describe("staff native shell", () => {
  it("is not native in the browser test environment", () => {
    expect(isStaffNativeApp()).toBe(false);
  });

  it("allows staff and legal routes only", () => {
    expect(isStaffNativeAllowedPath("/staff/login")).toBe(true);
    expect(isStaffNativeAllowedPath("/staff/dashboard")).toBe(true);
    expect(isStaffNativeAllowedPath("/privacy-policy")).toBe(true);
    expect(isStaffNativeAllowedPath("/customer/dashboard")).toBe(false);
    expect(isStaffNativeAllowedPath("/admin/dashboard")).toBe(false);
    expect(staffNativeHomePath()).toBe("/staff/login");
  });
});
