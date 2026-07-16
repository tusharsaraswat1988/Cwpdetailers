import { describe, it, expect } from "vitest";
import { buildCorrelation, createCoverageValidationId, resolveRequestId } from "./CoverageCorrelation";

describe("CoverageCorrelation", () => {
  it("creates unique coverage validation IDs", () => {
    const a = createCoverageValidationId();
    const b = createCoverageValidationId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it("uses x-request-id header when provided", () => {
    expect(resolveRequestId("req-abc")).toBe("req-abc");
  });

  it("builds correlation with booking id", () => {
    const c = buildCorrelation({ requestId: "req-1", bookingId: 99 });
    expect(c.requestId).toBe("req-1");
    expect(c.bookingId).toBe(99);
    expect(c.coverageValidationId).toBeTruthy();
  });
});
