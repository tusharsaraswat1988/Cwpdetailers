/**
 * Unit tests for Admin Branch Scope & Bridge Refresh Architecture
 * (ADMIN-020: Admin Branch Scope Hardening & Universal Data Refresh Repair)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage BEFORE Zustand store initialization
const mockStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStore[key] ?? null,
  setItem: (key: string, val: string) => {
    mockStore[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStore[key];
  },
  clear: () => {
    for (const k in mockStore) delete mockStore[k];
  },
  length: 0,
  key: () => null,
};
Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true });
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true });
}

import { useAppStore } from "@/lib/store";
import {
  switchActiveBranch,
  BRANCH_DEPENDENT_QUERY_KEYS,
} from "@/lib/branchScopeBridge";
import type { QueryClient } from "@tanstack/react-query";

describe("ADMIN-020: Frontend Central Branch Scope Bridge & Refresh", () => {
  let mockQueryClient: QueryClient;
  let invalidatedKeys: any[];

  beforeEach(() => {
    mockLocalStorage.clear();
    useAppStore.getState().clearScope();
    invalidatedKeys = [];
    mockQueryClient = {
      invalidateQueries: vi.fn(({ queryKey }) => {
        invalidatedKeys.push(queryKey);
        return Promise.resolve();
      }),
    } as unknown as QueryClient;
  });

  it("switchActiveBranch updates Zustand activeBranchId and activeCityId synchronously", () => {
    expect(useAppStore.getState().activeBranchId).toBeNull();
    expect(useAppStore.getState().activeCityId).toBeNull();

    switchActiveBranch(mockQueryClient, 2, 1, {
      branchName: "Noida Sector 62 Hub",
      cityName: "Noida",
      silent: true,
    });

    expect(useAppStore.getState().activeBranchId).toBe(2);
    expect(useAppStore.getState().activeCityId).toBe(1);
  });

  it("switchActiveBranch invalidates all registered branch-dependent queries", () => {
    switchActiveBranch(mockQueryClient, 3, 2, { silent: true });

    expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
    expect(invalidatedKeys.length).toBe(BRANCH_DEPENDENT_QUERY_KEYS.length);

    // Verify critical operational query keys are included
    const flatKeys = invalidatedKeys.map((k) => k[0]);
    expect(flatKeys).toContain("bookings");
    expect(flatKeys).toContain("customers");
    expect(flatKeys).toContain("staff");
    expect(flatKeys).toContain("subscriptions");
    expect(flatKeys).toContain("commercial-billing");
    expect(flatKeys).toContain("dcms");
    expect(flatKeys).toContain("operations-command-center");
    expect(flatKeys).toContain("assignments");
    expect(flatKeys).toContain("jobs");
    expect(flatKeys).toContain("leadStats");
    expect(flatKeys).toContain("churned");
    expect(flatKeys).toContain("calendar-hours");
  });

  it("switchActiveBranch fires custom DOM event for decoupled local states", () => {
    const eventSpy = vi.fn();
    window.addEventListener("cwp:branch-changed", eventSpy);

    switchActiveBranch(mockQueryClient, 5, 2, {
      branchName: "Varanasi Hub",
      cityName: "Varanasi",
      silent: true,
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const detail = (eventSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.branchId).toBe(5);
    expect(detail.cityId).toBe(2);
    expect(detail.branchName).toBe("Varanasi Hub");
    expect(detail.cityName).toBe("Varanasi");

    window.removeEventListener("cwp:branch-changed", eventSpy);
  });

  it("clearScope cleanses active branch and city on session termination", () => {
    useAppStore.getState().setActiveBranch(10, 2);
    expect(useAppStore.getState().activeBranchId).toBe(10);

    useAppStore.getState().clearScope();
    expect(useAppStore.getState().activeBranchId).toBeNull();
    expect(useAppStore.getState().activeCityId).toBeNull();
  });
});
