import { describe, it, expect } from "vitest";
import { mapAuthErrorMessage, AUTH_NEUTRAL_ERROR } from "./authErrorMessages";

describe("mapAuthErrorMessage", () => {
  it("neutralizes account enumeration messages", () => {
    expect(mapAuthErrorMessage("No account found for this phone number")).toBe(AUTH_NEUTRAL_ERROR);
    expect(mapAuthErrorMessage("This phone number is already registered")).toBe(AUTH_NEUTRAL_ERROR);
  });

  it("maps OTP expiry to friendly copy", () => {
    expect(mapAuthErrorMessage("Invalid or expired OTP")).toContain("OTP");
  });

  it("maps rate limit errors", () => {
    expect(mapAuthErrorMessage("Too many OTP requests")).toContain("Too many");
  });

  it("hides stack traces", () => {
    expect(mapAuthErrorMessage("Error: something at /path/to/file.ts:42")).toBe(AUTH_NEUTRAL_ERROR);
  });
});
