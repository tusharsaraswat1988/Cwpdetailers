import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

/**
 * ARCH-P1-03: Resets and purges all in-memory React Query cache entries.
 * Cancels active in-flight queries so pending network requests cannot write back
 * stale, confidential customer, staff, or admin tenant data into the cache
 * after user logout or session expiration.
 */
export function clearQueryCache(): void {
  try {
    void queryClient.cancelQueries();
  } catch {
    // Ignore cancellation errors during teardown
  }
  queryClient.clear();
}
