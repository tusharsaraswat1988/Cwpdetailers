function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
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

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  const res = await fetch("/api/push/vapid-public-key", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json() as { publicKey?: string };
  return data.publicKey ?? null;
}

export async function getPushStatus(): Promise<PushStatus | null> {
  const res = await fetch("/api/push/status", { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<PushStatus>;
}

async function clearBrowserPushSubscription(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (!existing) return;

  await fetch("/api/push/unregister", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: existing.endpoint }),
  }).catch(() => undefined);

  await existing.unsubscribe();
}

/**
 * Subscribe staff to push when browser permission is already granted.
 * Does not show the permission prompt — use subscribeToPush() after a user tap.
 */
export async function autoSubscribeStaffPushIfNeeded(): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: "unsupported" };
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
};

export async function subscribeToPush(
  options: SubscribeOptions = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: "Push notifications are not supported in this browser" };
  }

  const permission = getBrowserNotificationPermission();
  if (permission !== "granted") {
    if (options.skipPermissionRequest) {
      return { ok: false, error: "Notification permission not granted yet" };
    }
    const requested = await Notification.requestPermission();
    if (requested !== "granted") {
      return { ok: false, error: "Notification permission denied" };
    }
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    return { ok: false, error: "Push not configured on server (VAPID keys missing)" };
  }

  const registration = await navigator.serviceWorker.ready;
  await clearBrowserPushSubscription();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  const res = await fetch("/api/push/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: {
        endpoint: json.endpoint,
        keys: json.keys,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Registration failed" }));
    return { ok: false, error: (err as { error?: string }).error ?? "Registration failed" };
  }

  return { ok: true };
}

export async function resyncPushSubscription(): Promise<{ ok: true } | { ok: false; error: string }> {
  await clearBrowserPushSubscription();
  return subscribeToPush({ forceResync: true });
}

export async function unsubscribeFromPush(): Promise<void> {
  await clearBrowserPushSubscription();
}
