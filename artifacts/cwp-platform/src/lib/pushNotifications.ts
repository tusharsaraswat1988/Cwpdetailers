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

export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: "Push notifications are not supported in this browser" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Notification permission denied" };
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    return { ok: false, error: "Push not configured on server (VAPID keys missing)" };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

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

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/unregister", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}
