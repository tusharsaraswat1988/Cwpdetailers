import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getApiBaseUrl, isTrustedApiUrl, resolveApiUrl } from "./apiConfig";

describe("apiConfig", () => {
  const originalEnv = import.meta.env.VITE_API_URL;

  afterEach(() => {
    delete window.__CWP_API_URL__;
    (import.meta.env as Record<string, unknown>).VITE_API_URL = originalEnv;
  });

  describe("getApiBaseUrl", () => {
    it("returns empty string by default when no URL is set", () => {
      (import.meta.env as Record<string, unknown>).VITE_API_URL = "";
      expect(getApiBaseUrl()).toBe("");
    });

    it("reads from window.__CWP_API_URL__ if present", () => {
      window.__CWP_API_URL__ = "https://cwp-api.railway.app/";
      expect(getApiBaseUrl()).toBe("https://cwp-api.railway.app");
    });

    it("strips trailing slashes from VITE_API_URL", () => {
      (import.meta.env as Record<string, unknown>).VITE_API_URL = "https://backend.example.com///";
      expect(getApiBaseUrl()).toBe("https://backend.example.com");
    });
  });

  describe("isTrustedApiUrl", () => {
    beforeEach(() => {
      window.__CWP_API_URL__ = "https://backend.example.com";
    });

    it("trusts relative /api paths", () => {
      expect(isTrustedApiUrl("/api/auth/login")).toBe(true);
      expect(isTrustedApiUrl("/api/customers/me")).toBe(true);
      expect(isTrustedApiUrl("/api")).toBe(true);
    });

    it("trusts configured remote API origin with /api path", () => {
      expect(isTrustedApiUrl("https://backend.example.com/api/auth/me")).toBe(true);
      expect(isTrustedApiUrl("https://backend.example.com/api/bookings/1")).toBe(true);
    });

    it("rejects configured remote API without /api path", () => {
      expect(isTrustedApiUrl("https://backend.example.com/other-endpoint")).toBe(false);
    });

    it("strictly rejects third-party URLs to prevent token leakage", () => {
      expect(isTrustedApiUrl("https://api.cloudinary.com/v1_1/demo/image/upload")).toBe(false);
      expect(isTrustedApiUrl("https://maps.googleapis.com/maps/api/geocode/json")).toBe(false);
      expect(isTrustedApiUrl("https://evil-hacker.com/api/steal")).toBe(false);
      expect(isTrustedApiUrl("https://fast2sms.com/dev/bulkV2")).toBe(false);
    });
  });

  describe("resolveApiUrl", () => {
    it("returns relative string unchanged when baseUrl is empty", () => {
      (import.meta.env as Record<string, unknown>).VITE_API_URL = "";
      delete window.__CWP_API_URL__;
      expect(resolveApiUrl("/api/auth/me")).toBe("/api/auth/me");
    });

    it("prepends baseUrl to relative string when baseUrl is configured", () => {
      window.__CWP_API_URL__ = "https://backend.example.com";
      expect(resolveApiUrl("/api/auth/me")).toBe("https://backend.example.com/api/auth/me");
      expect(resolveApiUrl("/api/vehicles")).toBe("https://backend.example.com/api/vehicles");
    });

    it("leaves third-party absolute URLs untouched", () => {
      window.__CWP_API_URL__ = "https://backend.example.com";
      const cloudinary = "https://api.cloudinary.com/v1_1/demo/image/upload";
      expect(resolveApiUrl(cloudinary)).toBe(cloudinary);
    });
  });
});
