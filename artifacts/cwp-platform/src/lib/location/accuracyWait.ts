import type { StaffGpsCoords } from "./types";
import {
  GPS_ACCURACY_POLL_MS,
  GPS_ACCURACY_WAIT_MS,
  GPS_MAX_ACCURACY_METERS,
  GPS_TARGET_ACCURACY_METERS,
} from "./constants";

export type AccuracyWaitOptions = {
  targetMeters?: number;
  maxMeters?: number;
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Keep reading GPS until accuracy is good enough for geofenced punch/job actions.
 * Returns the best fix within timeout if it still meets the server max (200m).
 */
export async function waitForAccurateGps(
  read: () => Promise<StaffGpsCoords>,
  opts: AccuracyWaitOptions = {},
): Promise<StaffGpsCoords> {
  const target = opts.targetMeters ?? GPS_TARGET_ACCURACY_METERS;
  const maxAllowed = opts.maxMeters ?? GPS_MAX_ACCURACY_METERS;
  const timeoutMs = opts.timeoutMs ?? GPS_ACCURACY_WAIT_MS;
  const pollMs = opts.pollMs ?? GPS_ACCURACY_POLL_MS;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;

  const started = now();
  let best: StaffGpsCoords | null = null;

  while (now() - started < timeoutMs) {
    const coords = await read();
    if (!best || coords.accuracy < best.accuracy) best = coords;
    if (coords.accuracy <= target) return coords;

    const elapsed = now() - started;
    const remaining = timeoutMs - elapsed;
    if (remaining <= pollMs / 2) break;
    await sleep(Math.min(pollMs, remaining));
  }

  if (best && best.accuracy <= maxAllowed) return best;

  const shown = best ? Math.round(best.accuracy) : null;
  throw new Error(
    shown != null
      ? `GPS signal too weak (${shown}m). Move outdoors and wait for a better fix.`
      : "Could not get your location. Please try again.",
  );
}
