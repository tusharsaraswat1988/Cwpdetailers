import { describe, it, expect } from "vitest";
import { resolveMediaUrl, optimizeBrandLogoUrl } from "./media-url";

describe("SEC-025: Frontend Media URL HTTPS Sanitization", () => {
  it("upgrades http:// URLs to https:// to prevent mixed-content warnings", () => {
    const httpUrl = "http://res.cloudinary.com/demo/image/upload/sample.jpg";
    const upgraded = resolveMediaUrl(httpUrl);
    expect(upgraded).toBe("https://res.cloudinary.com/demo/image/upload/sample.jpg");
  });

  it("preserves valid https:// URLs", () => {
    const httpsUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
    expect(resolveMediaUrl(httpsUrl)).toBe(httpsUrl);
  });

  it("handles null, undefined, and empty string safely", () => {
    expect(resolveMediaUrl(null)).toBe("");
    expect(resolveMediaUrl(undefined)).toBe("");
    expect(resolveMediaUrl("")).toBe("");
  });

  it("upgrades http in optimizeBrandLogoUrl", () => {
    const httpLogo = "http://res.cloudinary.com/demo/image/upload/logo.png";
    const optimized = optimizeBrandLogoUrl(httpLogo);
    expect(optimized).toContain("https://res.cloudinary.com/demo/image/upload/");
    expect(optimized).toContain("e_trim,f_auto,q_auto");
    expect(optimized.startsWith("https://")).toBe(true);
  });
});
