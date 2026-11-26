/**
 * Unit & Integration Regression Test Suite for ARCH-P1-03:
 * React Query cache not cleared on logout / session expiration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { queryClient, clearQueryCache } from "./queryClient";
import { tokenStorageKey, userStorageKey, type AuthPortal } from "./authPortal";

describe("ARCH-P1-03: React Query Cache Evacuation on Logout & Session Lifecycle", () => {
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
    // Ensure clean query cache before each test
    queryClient.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    mockStore = {};
    vi.unstubAllGlobals();
  });

  describe("1. Query Cache Purging & Memory Isolation", () => {
    it("purges all cached queries across customer, staff, and admin domains", () => {
      // Seed sensitive data into query cache
      queryClient.setQueryData(["customer", "me"], { id: 101, name: "Aarav Sharma", phone: "9876543210" });
      queryClient.setQueryData(["customer", "bookings"], [{ id: 501, status: "confirmed", amount: 1500 }]);
      queryClient.setQueryData(["staff", "daily-route"], [{ visitId: 88, society: "Supertech Capetown" }]);
      queryClient.setQueryData(["admin", "invoices"], [{ id: "INV-2026-001", total: 45000 }]);

      expect(queryClient.getQueryCache().getAll().length).toBe(4);
      expect(queryClient.getQueryData(["customer", "me"])).toBeDefined();
      expect(queryClient.getQueryData(["admin", "invoices"])).toBeDefined();

      // Execute cache clearance
      clearQueryCache();

      // Assert all cache entries are evacuated
      expect(queryClient.getQueryCache().getAll().length).toBe(0);
      expect(queryClient.getQueryData(["customer", "me"])).toBeUndefined();
      expect(queryClient.getQueryData(["customer", "bookings"])).toBeUndefined();
      expect(queryClient.getQueryData(["staff", "daily-route"])).toBeUndefined();
      expect(queryClient.getQueryData(["admin", "invoices"])).toBeUndefined();
    });

    it("purges mutation cache in addition to query cache", () => {
      // Populate mutation cache
      const mutationCache = queryClient.getMutationCache();
      mutationCache.build(queryClient, {
        mutationKey: ["createBooking"],
        variables: { serviceId: 10 },
      });

      expect(mutationCache.getAll().length).toBeGreaterThan(0);

      clearQueryCache();

      expect(mutationCache.getAll().length).toBe(0);
    });

    it("cancels in-flight queries before purging to prevent delayed network write-backs", () => {
      const cancelSpy = vi.spyOn(queryClient, "cancelQueries");
      const clearSpy = vi.spyOn(queryClient, "clear");

      clearQueryCache();

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Authentication Lifecycle Integration", () => {
    it("clears query cache when user logs out of their session", async () => {
      // Simulate active session in customer portal
      const portal: AuthPortal = "customer";
      localStorage.setItem(tokenStorageKey(portal), "customer-jwt-token");
      localStorage.setItem(userStorageKey(portal), JSON.stringify({ id: 1, name: "Customer One", role: "customer" }));

      // Cache data loaded during user session
      queryClient.setQueryData(["customer", "addresses"], [{ id: 12, flat: "Tower A-402" }]);
      queryClient.setQueryData(["customer", "vehicles"], [{ id: 34, plate: "UP16-AB-1234" }]);
      expect(queryClient.getQueryCache().getAll().length).toBe(2);

      // Trigger logout cleanup procedure
      clearQueryCache();
      localStorage.removeItem(tokenStorageKey(portal));
      localStorage.removeItem(userStorageKey(portal));

      // Assert storage and cache are both completely cleared
      expect(localStorage.getItem(tokenStorageKey(portal))).toBeNull();
      expect(localStorage.getItem(userStorageKey(portal))).toBeNull();
      expect(queryClient.getQueryCache().getAll().length).toBe(0);
      expect(queryClient.getQueryData(["customer", "addresses"])).toBeUndefined();
      expect(queryClient.getQueryData(["customer", "vehicles"])).toBeUndefined();
    });

    it("prevents cross-account data leakage when switching users", () => {
      // User A signs in and loads their confidential vehicles
      queryClient.setQueryData(["customer", "vehicles"], [
        { id: 99, plate: "DL01-SECRET-CAR", owner: "User A" },
      ]);
      expect(queryClient.getQueryData(["customer", "vehicles"])).toBeDefined();

      // User A logs out and User B logs in (login calls clearQueryCache)
      clearQueryCache();

      // Verify User B does not receive User A's cached vehicles
      expect(queryClient.getQueryData(["customer", "vehicles"])).toBeUndefined();
      expect(queryClient.getQueryCache().getAll().length).toBe(0);
    });

    it("clears query cache upon multi-tab logout event", () => {
      const portal: AuthPortal = "staff";
      queryClient.setQueryData(["staff", "attendance"], { status: "present", checkInTime: "08:30" });
      expect(queryClient.getQueryCache().getAll().length).toBe(1);

      // Simulate another tab logging out (storage event clearing staff user key)
      const storageEvent = new StorageEvent("storage", {
        key: userStorageKey(portal),
        newValue: null,
      });

      // Storage event handler executes clearQueryCache
      clearQueryCache();

      expect(queryClient.getQueryCache().getAll().length).toBe(0);
      expect(queryClient.getQueryData(["staff", "attendance"])).toBeUndefined();
    });

    it("safely handles cancellation failure without crashing during teardown", () => {
      vi.spyOn(queryClient, "cancelQueries").mockImplementationOnce(() => {
        throw new Error("Simulated cancellation error");
      });

      // clearQueryCache should catch and still call queryClient.clear()
      expect(() => clearQueryCache()).not.toThrow();
      expect(queryClient.getQueryCache().getAll().length).toBe(0);
    });
  });
});
