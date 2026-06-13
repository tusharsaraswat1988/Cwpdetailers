/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(new NavigationRoute(
  new NetworkFirst({ cacheName: "pages" }),
  { denylist: [/^\/api/] },
));

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; tag?: string; data?: Record<string, unknown> } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title ?? "CWP Detailers";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: "/pwa/icon-192.png",
    badge: "/pwa/icon-192.png",
    tag: payload.tag ?? "cwp-push",
    data: { url: payload.url ?? "/", ...payload.data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string | undefined) ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

export {};
