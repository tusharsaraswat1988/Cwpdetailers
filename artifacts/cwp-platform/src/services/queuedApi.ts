import { fetchWithRetry } from "./apiRetry";
import { connectivityService } from "./connectivityService";
import { offlineQueue, type QueueOperationType } from "./offlineQueue";
import {
  canQueueOfflineOperation,
  SERVER_CONFIRMATION_REQUIRED_MESSAGE,
} from "./offlineQueuePolicy";

export type QueuedFetchMeta = {
  operationType: QueueOperationType;
  label: string;
  queueWhenOffline?: boolean;
};

export type QueuedFetchResult =
  | { ok: true; response: Response; queued: false }
  | { ok: true; queued: true; queueId: string }
  | { ok: false; error: Error; queued: false; requiresServerConfirmation?: boolean };

import { resolveAuthPortal, tokenStorageKey } from "@/lib/authPortal";

function buildHeaders(init?: RequestInit): Record<string, string> {
  const headers = new Headers(init?.headers);
  const portal = resolveAuthPortal();
  const token = localStorage.getItem(tokenStorageKey(portal));
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("X-Auth-Portal")) {
    headers.set("X-Auth-Portal", portal);
  }
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  return Object.fromEntries(headers.entries());
}

function isWriteMethod(method?: string): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

function resolveUrl(input: string): string {
  return input.startsWith("http") ? input : new URL(input, window.location.origin).toString();
}

function serverConfirmationError(): QueuedFetchResult {
  return {
    ok: false,
    error: new Error(SERVER_CONFIRMATION_REQUIRED_MESSAGE),
    queued: false,
    requiresServerConfirmation: true,
  };
}

/**
 * Write helper for queue-eligible operations only (bookings, customers, notes, expenses, follow-ups).
 * Payments, invoices, wallet, accounting, and inventory must use `fetchWithRetry` directly.
 */
export async function queuedFetch(
  input: string,
  init?: RequestInit,
  meta?: QueuedFetchMeta,
): Promise<QueuedFetchResult> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = resolveUrl(input);
  const queueEligible =
    meta?.queueWhenOffline !== false &&
    isWriteMethod(method) &&
    canQueueOfflineOperation(meta?.operationType, url);

  if (isWriteMethod(method) && meta && !canQueueOfflineOperation(meta.operationType, url)) {
    if (!connectivityService.canExecuteWrites()) {
      return serverConfirmationError();
    }
  }

  if (queueEligible && !connectivityService.canExecuteWrites()) {
    const item = await offlineQueue.enqueue({
      type: meta!.operationType,
      label: meta!.label,
      url,
      method,
      headers: buildHeaders(init),
      body: typeof init?.body === "string" ? init.body : init?.body ? JSON.stringify(init.body) : null,
    });
    return { ok: true, queued: true, queueId: item.id };
  }

  try {
    const response = await fetchWithRetry(input, {
      ...init,
      credentials: init?.credentials ?? "include",
    });
    if (response.ok) {
      connectivityService.markSyncSuccess();
    }
    return { ok: true, response, queued: false };
  } catch (err) {
    if (queueEligible) {
      const item = await offlineQueue.enqueue({
        type: meta!.operationType,
        label: meta!.label,
        url,
        method,
        headers: buildHeaders(init),
        body: typeof init?.body === "string" ? init.body : init?.body ? JSON.stringify(init.body) : null,
      });
      return { ok: true, queued: true, queueId: item.id };
    }

    return {
      ok: false,
      error: err instanceof Error ? err : new Error("Request failed"),
      queued: false,
      requiresServerConfirmation: isWriteMethod(method) && !queueEligible,
    };
  }
}

/** For payments, invoices, wallet, billing, inventory — never queued. */
export async function serverConfirmedFetch(
  input: string,
  init?: RequestInit,
): Promise<QueuedFetchResult> {
  if (isWriteMethod(init?.method) && !connectivityService.canExecuteWrites()) {
    return serverConfirmationError();
  }

  try {
    const response = await fetchWithRetry(input, {
      ...init,
      credentials: init?.credentials ?? "include",
    });
    if (response.ok) {
      connectivityService.markSyncSuccess();
    }
    return { ok: true, response, queued: false };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error("Request failed"),
      queued: false,
      requiresServerConfirmation: isWriteMethod(init?.method),
    };
  }
}

export async function fetchJsonWithRetry<T>(
  input: string,
  init?: RequestInit,
  meta?: QueuedFetchMeta,
): Promise<{ data?: T; queued?: boolean; error?: string; requiresServerConfirmation?: boolean }> {
  const result = await queuedFetch(input, init, meta);
  if (result.queued) return { queued: true };
  if (!result.ok) {
    return {
      error: result.error.message,
      requiresServerConfirmation: result.requiresServerConfirmation,
    };
  }
  if (!result.response.ok) return { error: `Request failed (${result.response.status})` };
  const data = (await result.response.json()) as T;
  return { data };
}
