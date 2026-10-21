import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { resolveAuthPortal } from "./authPortal";
import { setCachedNativePortal, portalHomePath, isStaffNativeApp, isCustomerNativeApp } from "./native/portalNative";
import { slotsForDate, SCHEDULE_TIME_SLOTS } from "./schedule-slots";

describe("Remediation Safeguards — Phase A, B, C, D", () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    });
    setCachedNativePortal(null);
    delete (window as unknown as { __CWP_APP_PORTAL__?: string }).__CWP_APP_PORTAL__;
  });

  afterEach(() => {
    mockStore = {};
    setCachedNativePortal(null);
    delete (window as unknown as { __CWP_APP_PORTAL__?: string }).__CWP_APP_PORTAL__;
    vi.unstubAllGlobals();
  });

  describe("Portal Separation & Root Native Pathing", () => {
    it("strictly isolates staff native app even when WebView root is /", () => {
      setCachedNativePortal("staff");
      expect(isStaffNativeApp()).toBe(true);
      expect(isCustomerNativeApp()).toBe(false);
      expect(resolveAuthPortal("/")).toBe("staff");
      expect(resolveAuthPortal("/customer")).toBe("staff");
      expect(resolveAuthPortal("/staff/dashboard")).toBe("staff");
    });

    it("strictly isolates customer native app even when WebView root is /", () => {
      setCachedNativePortal("customer");
      expect(isStaffNativeApp()).toBe(false);
      expect(isCustomerNativeApp()).toBe(true);
      expect(resolveAuthPortal("/")).toBe("customer");
      expect(resolveAuthPortal("/staff/dashboard")).toBe("customer");
    });

    it("routes authenticated staff to /staff/dashboard and unauthenticated staff to /staff/login", () => {
      // Unauthenticated
      expect(portalHomePath("staff")).toBe("/staff/login");

      // Authenticated with staff token
      localStorage.setItem("cwp_token_staff", "test-staff-bearer-jwt");
      expect(portalHomePath("staff")).toBe("/staff/dashboard");

      // Authenticated with staff user
      localStorage.removeItem("cwp_token_staff");
      localStorage.setItem("cwp_user_staff", JSON.stringify({ id: 1, role: "staff" }));
      expect(portalHomePath("staff")).toBe("/staff/dashboard");
    });
  });

  describe("Schedule Slots Time Evaluation", () => {
    it("filters past time slots when date is today", () => {
      // Fixed time: 14:30 (2:30 PM) on 2026-08-10
      const now = new Date("2026-08-10T14:30:00");
      const slots = slotsForDate("2026-08-10", now);
      // All slots returned must be after 14:00 (i.e. >= 15:00)
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every(s => parseInt(s.split(":")[0], 10) > 14)).toBe(true);
      expect(slots).toContain("15:00");
      expect(slots).not.toContain("14:00");
      expect(slots).not.toContain("08:00");
    });

    it("preserves all available time slots when date is in the future", () => {
      const now = new Date("2026-08-10T14:30:00");
      const futureSlots = slotsForDate("2026-08-11", now);
      expect(futureSlots).toEqual([...SCHEDULE_TIME_SLOTS]);
    });
  });
});
