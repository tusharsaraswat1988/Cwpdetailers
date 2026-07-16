import { describe, it, expect, beforeEach } from "vitest";
import {
  coverageCache,
  cacheKey,
  invalidateCoverageCacheForMasterUpdate,
  resetCoverageCacheForTests,
  COVERAGE_CACHE_DEFAULT_TTL_MS,
} from "./CoverageCache";

describe("CoverageCache", () => {
  beforeEach(() => {
    resetCoverageCacheForTests();
  });

  it("returns undefined on cache miss", () => {
    expect(coverageCache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves on cache hit", () => {
    coverageCache.set("hit", { id: 1 }, COVERAGE_CACHE_DEFAULT_TTL_MS);
    expect(coverageCache.get<{ id: number }>("hit")).toEqual({ id: 1 });
  });

  it("invalidates city namespace on cities master update", () => {
    coverageCache.set(cacheKey("city", "id", 1), { id: 1 });
    coverageCache.set(cacheKey("services", "city", 1), { availableServices: [] });
    invalidateCoverageCacheForMasterUpdate("cities");
    expect(coverageCache.get(cacheKey("city", "id", 1))).toBeUndefined();
    expect(coverageCache.get(cacheKey("services", "city", 1))).toBeUndefined();
  });

  it("invalidates pincode key on pincodes master update", () => {
    coverageCache.set(cacheKey("pin", "221005"), { pincode: "221005" });
    invalidateCoverageCacheForMasterUpdate("pincodes", { pincode: "221005" });
    expect(coverageCache.get(cacheKey("pin", "221005"))).toBeUndefined();
  });

  it("invalidates service availability by cityId", () => {
    coverageCache.set(cacheKey("services", "city", 7), { availableServices: [] });
    invalidateCoverageCacheForMasterUpdate("service_availability", { cityId: 7 });
    expect(coverageCache.get(cacheKey("services", "city", 7))).toBeUndefined();
  });
});
