import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isPortalAllowedPath,
  portalHomePath,
  isRootScreenForPortal,
  setCachedNativePortal,
  getSyncNativePortal,
} from "./portalNative";

describe("portalNative isolation logic", () => {
  beforeEach(() => {
    setCachedNativePortal(null);
    delete window.__CWP_APP_PORTAL__;
  });

  afterEach(() => {
    setCachedNativePortal(null);
    delete window.__CWP_APP_PORTAL__;
  });

  describe("Staff Portal Isolation", () => {
    it("allows staff routes and public legal pages", () => {
      expect(isPortalAllowedPath("staff", "/staff/login")).toBe(true);
      expect(isPortalAllowedPath("staff", "/staff/dashboard")).toBe(true);
      expect(isPortalAllowedPath("staff", "/staff/daily-clean")).toBe(true);
      expect(isPortalAllowedPath("staff", "/staff/jobs/42")).toBe(true);
      expect(isPortalAllowedPath("staff", "/privacy-policy")).toBe(true);
      expect(isPortalAllowedPath("staff", "/terms-and-conditions")).toBe(true);
    });

    it("rejects customer, admin, and franchisee routes in Staff App", () => {
      expect(isPortalAllowedPath("staff", "/customer/dashboard")).toBe(false);
      expect(isPortalAllowedPath("staff", "/customer/plans")).toBe(false);
      expect(isPortalAllowedPath("staff", "/admin/dashboard")).toBe(false);
      expect(isPortalAllowedPath("staff", "/franchisee/dashboard")).toBe(false);
      expect(isPortalAllowedPath("staff", "/login")).toBe(false);
    });

    it("identifies staff root screens for hardware back button minimize", () => {
      expect(isRootScreenForPortal("staff", "/staff/login")).toBe(true);
      expect(isRootScreenForPortal("staff", "/staff/dashboard")).toBe(true);
      expect(isRootScreenForPortal("staff", "/staff/jobs/42")).toBe(false);
      expect(isRootScreenForPortal("staff", "/staff/daily-clean")).toBe(false);
    });

    it("returns /staff/login as default home", () => {
      expect(portalHomePath("staff")).toBe("/staff/login");
    });
  });

  describe("Customer Portal Isolation", () => {
    it("allows customer routes, auth pages, and legal pages", () => {
      expect(isPortalAllowedPath("customer", "/customer/dashboard")).toBe(true);
      expect(isPortalAllowedPath("customer", "/customer/plans")).toBe(true);
      expect(isPortalAllowedPath("customer", "/customer/schedule")).toBe(true);
      expect(isPortalAllowedPath("customer", "/customer/assets")).toBe(true);
      expect(isPortalAllowedPath("customer", "/customer/account")).toBe(true);
      expect(isPortalAllowedPath("customer", "/login")).toBe(true);
      expect(isPortalAllowedPath("customer", "/register")).toBe(true);
      expect(isPortalAllowedPath("customer", "/verify-otp")).toBe(true);
      expect(isPortalAllowedPath("customer", "/privacy-policy")).toBe(true);
      expect(isPortalAllowedPath("customer", "/")).toBe(true);
    });

    it("strictly blocks staff, admin, and franchisee routes in Customer App", () => {
      expect(isPortalAllowedPath("customer", "/staff/login")).toBe(false);
      expect(isPortalAllowedPath("customer", "/staff/dashboard")).toBe(false);
      expect(isPortalAllowedPath("customer", "/admin/dashboard")).toBe(false);
      expect(isPortalAllowedPath("customer", "/franchisee/dashboard")).toBe(false);
    });

    it("identifies customer root screens for hardware back button minimize", () => {
      expect(isRootScreenForPortal("customer", "/customer/dashboard")).toBe(true);
      expect(isRootScreenForPortal("customer", "/login")).toBe(true);
      expect(isRootScreenForPortal("customer", "/register")).toBe(true);
      expect(isRootScreenForPortal("customer", "/")).toBe(true);
      expect(isRootScreenForPortal("customer", "/customer/plans/12")).toBe(false);
      expect(isRootScreenForPortal("customer", "/customer/schedule/34")).toBe(false);
    });

    it("returns /customer/dashboard as default home", () => {
      expect(portalHomePath("customer")).toBe("/customer/dashboard");
    });
  });

  describe("Web Environment (None)", () => {
    it("permits any path when running in standard web browser", () => {
      expect(isPortalAllowedPath("none", "/admin/dashboard")).toBe(true);
      expect(isPortalAllowedPath("none", "/staff/dashboard")).toBe(true);
      expect(isPortalAllowedPath("none", "/customer/dashboard")).toBe(true);
    });
  });
});
