/**
 * In-process master-data cache for the Coverage Engine.
 *
 * TTL strategy:
 * - Default TTL: 5 minutes (balances freshness vs DB load).
 * - Admin master-data mutations invalidate affected namespaces immediately.
 * - Node.js single-process model — safe for Express without explicit locks.
 * - For multi-instance deployments, TTL bounds staleness until Phase 3 (Redis).
 */

export const COVERAGE_CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000;

export type CoverageCacheAccessEvent = {
  hit: boolean;
  key: string;
  namespace: string;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

function namespaceFromKey(key: string): string {
  const idx = key.indexOf(":");
  return idx >= 0 ? key.slice(0, idx) : key;
}

class CoverageCacheStore {
  private store = new Map<string, CacheEntry<unknown>>();
  private accessCollector: CoverageCacheAccessEvent[] | null = null;

  beginAccessCollection(collector: CoverageCacheAccessEvent[]): void {
    this.accessCollector = collector;
  }

  endAccessCollection(): void {
    this.accessCollector = null;
  }

  private recordAccess(hit: boolean, key: string): void {
    this.accessCollector?.push({
      hit,
      key,
      namespace: namespaceFromKey(key),
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.recordAccess(false, key);
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.recordAccess(false, key);
      return undefined;
    }
    this.recordAccess(true, key);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = COVERAGE_CACHE_DEFAULT_TTL_MS): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }

  stats() {
    return { size: this.store.size };
  }
}

export const coverageCache = new CoverageCacheStore();

export function beginAccessCollection(collector: CoverageCacheAccessEvent[]): void {
  coverageCache.beginAccessCollection(collector);
}

export function endAccessCollection(): void {
  coverageCache.endAccessCollection();
}

export type CoverageCacheNamespace =
  | "cities"
  | "pincodes"
  | "service_areas"
  | "service_availability";

export function cacheKey(namespace: string, ...parts: (string | number)[]): string {
  return `${namespace}:${parts.join(":")}`;
}

/** Invalidate cache after admin master-data or catalog availability changes. */
export function invalidateCoverageCacheForMasterUpdate(
  namespace: CoverageCacheNamespace,
  opts?: { cityId?: number; pincode?: string },
): void {
  switch (namespace) {
    case "cities":
      coverageCache.invalidatePrefix("city:");
      coverageCache.invalidatePrefix("services:city:");
      break;
    case "pincodes":
      if (opts?.pincode) coverageCache.delete(cacheKey("pin", opts.pincode));
      coverageCache.invalidatePrefix("pin:");
      break;
    case "service_areas":
      coverageCache.invalidatePrefix("pin:");
      coverageCache.invalidatePrefix("area:");
      break;
    case "service_availability":
      if (opts?.cityId != null) {
        coverageCache.delete(cacheKey("services", "city", opts.cityId));
      } else {
        coverageCache.invalidatePrefix("services:city:");
      }
      break;
    default:
      coverageCache.clear();
  }
}

/** Test helper — reset cache between unit tests. */
export function resetCoverageCacheForTests(): void {
  coverageCache.clear();
}
