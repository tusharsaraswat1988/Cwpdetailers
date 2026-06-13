import { fetchWithRetry } from "./apiRetry";
import { connectivityService } from "./connectivityService";
import { offlineQueue, type QueueOperationType } from "./offlineQueue";

export type QueuedFetchMeta = {
  operationType: QueueOperationType;
  label: string;
  queueWhenOffline?: boolean;
};

export type QueuedFetchResult =
  | { ok: true; response: Response; queued: false }
  | { ok: true; queued: true; queueId: string }
  | { ok: false; error: Error; queued: false };

function buildHeaders(init?: RequestInit): Record<string, string> {
  const headers = new Headers(init?.headers);
  const token = localStorage.getItem("cwp_token");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
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

export async function queuedFetch(
  input: string,
  init?: RequestInit,
  meta?: QueuedFetchMeta,
): Promise<QueuedFetchResult> {
  const method = (init?.method ?? "GET").toUpperCase();
  const shouldQueue = meta?.queueWhenOffline !== false && isWriteMethod(method);

  if (shouldQueue && !connectivityService.canExecuteWrites()) {
    const item = await offlineQueue.enqueue({
      type: meta?.operationType ?? "note",
      label: meta?.label ?? `${method} ${input}`,
      url: input.startsWith("http") ? input : new URL(input, window.location.origin).toString(),
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
    if (shouldQueue) {
      const item = await offlineQueue.enqueue({
        type: meta?.operationType ?? "note",
        label: meta?.label ?? `${method} ${input}`,
        url: input.startsWith("http") ? input : new URL(input, window.location.origin).toString(),
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
    };
  }
}

export async function fetchJsonWithRetry<T>(
  input: string,
  init?: RequestInit,
  meta?: QueuedFetchMeta,
): Promise<{ data?: T; queued?: boolean; error?: string }> {
  const result = await queuedFetch(input, init, meta);
  if (result.queued) return { queued: true };
  if (!result.ok) return { error: result.error.message };
  if (!result.response.ok) return { error: `Request failed (${result.response.status})` };
  const data = (await result.response.json()) as T;
  return { data };
}
