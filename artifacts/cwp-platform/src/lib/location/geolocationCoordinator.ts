/**
 * Serializes geolocation reads and pauses foreground watchPosition while
 * getCurrentPosition runs. Prevents mobile browsers from failing action GPS
 * when watchPosition + background refresh are already active.
 */

let suspendWatch: (() => void) | null = null;
let resumeWatch: (() => void) | null = null;
let readChain: Promise<unknown> = Promise.resolve();

export function registerStaffGeolocationWatch(hooks: {
  suspend: () => void;
  resume: () => void;
}): void {
  suspendWatch = hooks.suspend;
  resumeWatch = hooks.resume;
}

export function clearStaffGeolocationWatchRegistration(): void {
  suspendWatch = null;
  resumeWatch = null;
}

/** One getCurrentPosition at a time; pause watch while reading. */
export function runExclusiveGeolocationRead<T>(fn: () => Promise<T>): Promise<T> {
  const next = readChain.then(async () => {
    suspendWatch?.();
    try {
      return await fn();
    } finally {
      resumeWatch?.();
    }
  });

  readChain = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}

/** Reset coordinator between tests. */
export function resetGeolocationCoordinatorForTests(): void {
  readChain = Promise.resolve();
  suspendWatch = null;
  resumeWatch = null;
}
