function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Chrome PushManager is picky about views onto larger buffers — copy into a tight ArrayBuffer. */
export function toApplicationServerKey(publicKey: string): ArrayBuffer {
  const bytes = urlBase64ToUint8Array(publicKey.trim());
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof window.setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export type PushStatus = {
  subscribed: boolean;
  subscriptionCount: number;
  pushConfigured: boolean;
  lastNotification: {
    title: string;
    body: string;
    receivedAt: string;
  } | null;
};

export type PushSubscribeProgress =
  | "requesting-permission"
  | "waiting-service-worker"
  | "subscribing"
  | "registering";

export type PushSubscribeErrorCode =
  | "unsupported"
  | "insecure"
  | "denied"
  | "dismissed"
  | "timeout-permission"
  | "no-service-worker"
  | "not-configured"
  | "subscribe-failed"
  | "register-failed";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; error: string; code: PushSubscribeErrorCode };

const PERMISSION_HINT_MS = 2_500;
const SW_TIMEOUT_MS = 8_000;
const SUBSCRIBE_TIMEOUT_MS = 12_000;
const API_TIMEOUT_MS = 10_000;

let vapidPublicKeyCache: string | null | undefined;
let pwaRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let subscribeInflight: Promise<PushSubscribeResult> | null = null;

/** Wired from `initPwa()` so subscribe does not wait forever on `serviceWorker.ready`. */
export function setPushServiceWorkerRegistration(
  promise: Promise<ServiceWorkerRegistration | null>,
): void {
  pwaRegistrationPromise = promise;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function isNotificationSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  if (vapidPublicKeyCache !== undefined) return vapidPublicKeyCache;
  try {
    const res = await fetchWithTimeout("/api/push/vapid-public-key", { credentials: "include" }, API_TIMEOUT_MS);
    if (!res.ok) {
      vapidPublicKeyCache = null;
      return null;
    }
    const data = await res.json() as { publicKey?: string | null; configured?: boolean };
    const key = data.publicKey?.trim() || null;
    vapidPublicKeyCache = key;
    return key;
  } catch {
    vapidPublicKeyCache = undefined;
    return null;
  }
}

export async function getPushStatus(): Promise<PushStatus | null> {
  try {
    const res = await fetchWithTimeout("/api/push/status", { credentials: "include" }, API_TIMEOUT_MS);
    if (!res.ok) return null;
    return res.json() as Promise<PushStatus>;
  } catch {
    return null;
  }
}

function fail(code: PushSubscribeErrorCode, error: string): PushSubscribeResult {
  return { ok: false, error, code };
}

async function waitForWorkerActivated(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  if (worker.state === "activated") return;
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const onChange = () => {
        if (worker.state === "activated") {
          worker.removeEventListener("statechange", onChange);
          resolve();
        } else if (worker.state === "redundant") {
          worker.removeEventListener("statechange", onChange);
          reject(new Error("Service worker became redundant"));
        }
      };
      worker.addEventListener("statechange", onChange);
    }),
    timeoutMs,
    "Service worker did not activate in time",
  );
}

async function activateRegistration(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
  const pending = registration.active ?? registration.waiting ?? registration.installing;
  if (pending && pending.state !== "activated") {
    await waitForWorkerActivated(pending, SW_TIMEOUT_MS);
  }
  if (registration.active) return registration;
  throw new Error("Service worker is not active");
}

export async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser");
  }

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;

  if (pwaRegistrationPromise) {
    const fromPwa = await Promise.race([
      pwaRegistrationPromise,
      sleep(SW_TIMEOUT_MS).then(() => null),
    ]);
    if (fromPwa) return activateRegistration(fromPwa);
  }

  if (existing) return activateRegistration(existing);

  try {
    const ready = await withTimeout(
      navigator.serviceWorker.ready,
      SW_TIMEOUT_MS,
      "Service worker did not become ready",
    );
    return ready;
  } catch {
    throw new Error("Service worker did not become ready");
  }
}

/**
 * Prefetch VAPID + activate SW on dashboard load so the Allow tap can show
 * Chrome's permission popup immediately (user-gesture, no wait).
 */
export async function warmUpPushInfrastructure(): Promise<void> {
  if (!isPushSupported() || !isNotificationSecureContext()) return;
  await Promise.allSettled([
    fetchVapidPublicKey(),
    ensureServiceWorkerRegistration(),
  ]);
}

type RequestPermissionFn = (
  deprecatedCallback?: (permission: NotificationPermission) => void,
) => Promise<NotificationPermission> | void;

async function requestNotificationPermission(): Promise<NotificationPermission> {
  const current = getBrowserNotificationPermission();
  if (current === "unsupported") return "denied";
  if (current !== "default") return current;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (permission: NotificationPermission) => {
      if (settled) return;
      settled = true;
      resolve(permission);
    };

    try {
      // Callback + promise: some Chrome builds resolve only one of the two.
      const request = Notification.requestPermission.bind(Notification) as RequestPermissionFn;
      const maybePromise = request(finish);
      if (maybePromise && typeof maybePromise.then === "function") {
        void maybePromise.then(finish, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function clearBrowserPushSubscription(registration: ServiceWorkerRegistration): Promise<void> {
  const existing = await registration.pushManager.getSubscription();
  if (!existing) return;

  await fetchWithTimeout(
    "/api/push/unregister",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: existing.endpoint }),
    },
    API_TIMEOUT_MS,
  ).catch(() => undefined);

  await existing.unsubscribe();
}

async function registerSubscriptionWithServer(subscription: PushSubscription): Promise<PushSubscribeResult> {
  const json = subscription.toJSON();
  const res = await fetchWithTimeout(
    "/api/push/register",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: {
          endpoint: json.endpoint,
          keys: json.keys,
        },
      }),
    },
    API_TIMEOUT_MS,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Registration failed" }));
    return fail("register-failed", (err as { error?: string }).error ?? "Registration failed");
  }

  return { ok: true };
}

/**
 * Subscribe staff to push when browser permission is already granted.
 * Does not show the permission prompt — use subscribeToPush() after a user tap.
 */
export async function autoSubscribeStaffPushIfNeeded(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: "unsupported" };
  if (!isNotificationSecureContext()) return { ok: false, error: "insecure" };
  if (getBrowserNotificationPermission() === "denied") return { ok: false, error: "denied" };
  if (getBrowserNotificationPermission() !== "granted") {
    return { ok: false, error: "permission not granted" };
  }

  const status = await getPushStatus();
  if (!status?.pushConfigured) return { ok: false, error: "not configured" };
  if (status.subscribed) return { ok: true };

  const result = await subscribeToPush({ skipPermissionRequest: true });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

type SubscribeOptions = {
  /** When true, only subscribe if Notification.permission is already granted. */
  skipPermissionRequest?: boolean;
  /** Force a fresh browser subscription (fixes VAPID key rotation). */
  forceResync?: boolean;
  onProgress?: (stage: PushSubscribeProgress) => void;
};

export async function subscribeToPush(
  options: SubscribeOptions = {},
): Promise<PushSubscribeResult> {
  if (subscribeInflight) return subscribeInflight;
  subscribeInflight = subscribeToPushInternal(options).finally(() => {
    subscribeInflight = null;
  });
  return subscribeInflight;
}

async function subscribeToPushInternal(options: SubscribeOptions): Promise<PushSubscribeResult> {
  const onProgress = options.onProgress;

  if (!isPushSupported()) {
    return fail("unsupported", "Push notifications are not supported in this browser");
  }
  if (!isNotificationSecureContext()) {
    return fail(
      "insecure",
      "Chrome only allows notifications on HTTPS or localhost. Open the app from a secure URL.",
    );
  }

  const existingPermission = getBrowserNotificationPermission();
  if (existingPermission !== "granted") {
    if (options.skipPermissionRequest) {
      return fail("dismissed", "Notification permission not granted yet");
    }
    onProgress?.("requesting-permission");
    // First await must be the permission prompt so Chrome keeps the user gesture
    // and shows the Allow / Block dialog (same as other sites).
    const requested = await requestNotificationPermission();
    if (requested === "denied") {
      return fail(
        "denied",
        "Notifications are blocked. Click the lock icon in the address bar → Site settings → Notifications → Allow.",
      );
    }
    if (requested !== "granted") {
      return fail(
        "dismissed",
        "Chrome did not get Allow. If no popup appeared, click the lock or bell icon in the address bar, then Allow.",
      );
    }
  }

  onProgress?.("waiting-service-worker");
  const [publicKey, registration] = await Promise.all([
    fetchVapidPublicKey(),
    ensureServiceWorkerRegistration().catch(() => null),
  ]);

  if (!publicKey) {
    return fail("not-configured", "Push not configured on server (VAPID keys missing)");
  }
  if (!registration) {
    return fail(
      "no-service-worker",
      "This page is not ready for alerts yet. Refresh once, then tap Allow notifications again.",
    );
  }

  try {
    onProgress?.("subscribing");
    if (options.forceResync) {
      await clearBrowserPushSubscription(registration);
    } else {
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        onProgress?.("registering");
        return await registerSubscriptionWithServer(existing);
      }
    }

    const subscription = await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toApplicationServerKey(publicKey),
      }),
      SUBSCRIBE_TIMEOUT_MS,
      "Chrome did not finish enabling notifications",
    );

    onProgress?.("registering");
    return await registerSubscriptionWithServer(subscription);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not subscribe to push";
    if (/denied|not allowed|permission/i.test(message)) {
      return fail(
        "denied",
        "Notifications are blocked. Click the lock icon in the address bar → Site settings → Notifications → Allow.",
      );
    }
    return fail(
      "subscribe-failed",
      message.includes("Service worker") || message.includes("ready")
        ? "This page is not ready for alerts yet. Refresh once, then tap Allow notifications again."
        : message,
    );
  }
}

export async function resyncPushSubscription(): Promise<PushSubscribeResult> {
  return subscribeToPush({ forceResync: true });
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await ensureServiceWorkerRegistration();
    await clearBrowserPushSubscription(registration);
  } catch {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) await clearBrowserPushSubscription(registration);
  }
}

export { PERMISSION_HINT_MS };
