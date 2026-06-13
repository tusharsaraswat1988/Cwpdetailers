/** Retry policy: 1m → 5m → 15m → 1h (configurable max retries) */

export const DEFAULT_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
];

export function getRetryDelayMs(retryCount: number, delays = DEFAULT_RETRY_DELAYS_MS): number | null {
  if (retryCount >= delays.length) return null;
  return delays[retryCount] ?? delays[delays.length - 1]!;
}

export function computeNextRetryAt(retryCount: number, from = new Date()): Date | null {
  const delay = getRetryDelayMs(retryCount);
  if (delay == null) return null;
  return new Date(from.getTime() + delay);
}

export function shouldDeadLetter(retryCount: number, maxRetries: number): boolean {
  return retryCount >= maxRetries;
}
