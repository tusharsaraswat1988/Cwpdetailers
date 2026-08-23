import { describe, expect, it } from "vitest";
import { hasLocalSessionEvidence } from "./auth";

describe("hasLocalSessionEvidence", () => {
  it("is false for logged-out visitors with no cached portal session", () => {
    expect(hasLocalSessionEvidence(null, null)).toBe(false);
  });

  it("is true when a bearer token or cached user exists", () => {
    expect(hasLocalSessionEvidence("token", null)).toBe(true);
    expect(
      hasLocalSessionEvidence(null, {
        id: 1,
        name: "Ada",
        phone: "9000000000",
        role: "customer",
      }),
    ).toBe(true);
  });
});
