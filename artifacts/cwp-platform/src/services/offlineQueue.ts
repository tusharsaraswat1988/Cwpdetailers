import { idbDelete, idbGetAll, idbPut, isIndexedDBAvailable } from "./idb";
import { fetchWithRetry } from "./apiRetry";
import { connectivityService } from "./connectivityService";
import {
  canQueueOfflineOperation,
  type QueueOperationType,
  SERVER_CONFIRMATION_REQUIRED_MESSAGE,
} from "./offlineQueuePolicy";

export type { QueueOperationType } from "./offlineQueuePolicy";

export type FailureClassification =
  | "permanent_validation" // 400, 422
  | "permanent_forbidden"  // 403
  | "permanent_not_found"  // 404
  | "auth_required"        // 401
  | "conflict"             // 409
  | "client_error"         // other 4xx
  | "retryable_network"    // network error, timeout, fetch drop
  | "retryable_server"     // 5xx, 408, 429
  | "exhausted_retries"    // bounded retries exceeded
  | "corrupted";           // unparseable or corrupted item

export type DeadLetterRecord = {
  originalQueueId: string;
  operationType: QueueOperationType;
  entityRef?: string | null;
  payload: string | null;
  classification: FailureClassification;
  httpStatus?: number | null;
  safeErrorMessage: string;
  attempts: number;
  firstFailedAt: string;
  lastFailedAt: string;
  quarantinedAt: string;
  recoveryStatus: "quarantined" | "recovering" | "resolved" | "discarded";
};

export type QueueItemStatus = "pending" | "syncing" | "failed" | "quarantined";

export type QueueItem = {
  id: string;
  type: QueueOperationType;
  label: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  createdAt: string;
  retries: number;
  status: QueueItemStatus;
  lastError?: string;
  staffId?: number | null;
  userId?: number | null;
  firstFailedAt?: string;
  lastFailedAt?: string;
  dlq?: DeadLetterRecord;
};

export type QueueListenerDetails = {
  quarantinedCount: number;
  authRequired: boolean;
};

export type QueueListener = (
  pendingCount: number,
  syncing: boolean,
  details?: QueueListenerDetails,
) => void;

export const MAX_RETRY_ATTEMPTS = 3;

const STORAGE_KEY = "cwp_offline_queue_fallback";

function getActiveStaffIdentity(): { staffId: number | null; userId: number | null } {
  try {
    if (typeof localStorage === "undefined") return { staffId: null, userId: null };
    const raw = localStorage.getItem("cwp_user_staff");
    if (raw) {
      const u = JSON.parse(raw);
      return {
        staffId: typeof u.staffId === "number" ? u.staffId : null,
        userId: typeof u.id === "number" ? u.id : null,
      };
    }
  } catch {
    // ignore
  }
  return { staffId: null, userId: null };
}

/**
 * Extracts a safe entity identifier for DLQ tracking (e.g. "staff:10", "booking:42", or label).
 */
export function extractEntityRef(item: Pick<QueueItem, "url" | "label" | "type" | "body">): string {
  try {
    const urlObj = new URL(item.url, "http://local");
    const segments = urlObj.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const last = segments[segments.length - 1];
      const prev = segments[segments.length - 2];
      if (/^\d+$/.test(last)) return `${prev}:${last}`;
      if (/^\d+$/.test(prev)) return `${segments[segments.length - 3] || prev}:${prev}`;
    }
  } catch {
    // ignore
  }
  return item.label || item.type;
}

/**
 * Centralized error classifier for offline queue synchronization (ARCH-P1-02).
 */
export function classifySyncError(
  err: unknown,
  response?: Response | null,
  operationType?: QueueOperationType,
): {
  classification: FailureClassification;
  isRetryable: boolean;
  httpStatus?: number | null;
  safeMessage: string;
} {
  let status: number | null = null;
  if (response && typeof response.status === "number") {
    status = response.status;
  } else if (err instanceof Error) {
    const match = err.message.match(/HTTP\s+(\d{3})/i);
    if (match) {
      status = parseInt(match[1], 10);
    }
  }

  if (status !== null) {
    if (status === 401) {
      return {
        classification: "auth_required",
        isRetryable: false,
        httpStatus: 401,
        safeMessage: "Session expired or authentication required. Please log in to sync.",
      };
    }

    if (status === 409) {
      return {
        classification: "conflict",
        isRetryable: false,
        httpStatus: 409,
        safeMessage: "Record conflict detected on server. Item may already be synced.",
      };
    }

    if (status === 400 || status === 422) {
      return {
        classification: "permanent_validation",
        isRetryable: false,
        httpStatus: status,
        safeMessage: `Validation rejected (${status}): Permanent payload mismatch.`,
      };
    }

    if (status === 403) {
      return {
        classification: "permanent_forbidden",
        isRetryable: false,
        httpStatus: 403,
        safeMessage: "Access forbidden (403): Unauthorized operation.",
      };
    }

    if (status === 404) {
      return {
        classification: "permanent_not_found",
        isRetryable: false,
        httpStatus: 404,
        safeMessage: "Target record not found on server (404).",
      };
    }

    if (status === 408 || status === 429) {
      return {
        classification: "retryable_server",
        isRetryable: true,
        httpStatus: status,
        safeMessage: status === 429 ? "Server rate-limited. Retrying after backoff." : "Request timed out. Retrying.",
      };
    }

    if (status >= 400 && status < 500) {
      return {
        classification: "client_error",
        isRetryable: false,
        httpStatus: status,
        safeMessage: `Client error (${status}): Unprocessable request.`,
      };
    }

    if (status >= 500) {
      return {
        classification: "retryable_server",
        isRetryable: true,
        httpStatus: status,
        safeMessage: `Server error (${status}): Temporary failure. Retrying.`,
      };
    }
  }

  // Network / fetch / DOMException errors
  if (
    err instanceof TypeError ||
    (err instanceof Error && /network|fetch|failed to fetch|offline/i.test(err.message))
  ) {
    return {
      classification: "retryable_network",
      isRetryable: true,
      httpStatus: null,
      safeMessage: "Network connection unavailable. Retrying when connection returns.",
    };
  }

  return {
    classification: "retryable_network",
    isRetryable: true,
    httpStatus: null,
    safeMessage: err instanceof Error ? err.message : "Sync attempt failed",
  };
}

/**
 * Inspects 409 Conflict to determine if an action was already completed on the server
 * and can be safely reconciled rather than failing.
 */
export function handleConflictResponse(item: QueueItem, err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (item.type === "staff_attendance") {
    // Attendance punch for date already exists on server
    return true;
  }
  if (item.type === "staff_visit" || item.type === "staff_job") {
    if (msg.includes("already") || msg.includes("duplicate") || msg.includes("conflict")) {
      return true;
    }
  }
  return false;
}

class OfflineQueueService {
  private listeners = new Set<QueueListener>();
  private syncing = false;
  private authPaused = false;
  private syncPromise: Promise<void> | null = null;

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    void this.getQueueMetrics().then((metrics) => {
      listener(metrics.pendingCount, this.syncing, {
        quarantinedCount: metrics.quarantinedCount,
        authRequired: this.authPaused,
      });
    });
    return () => this.listeners.delete(listener);
  }

  isSyncing(): boolean {
    return this.syncing;
  }

  isAuthPaused(): boolean {
    return this.authPaused;
  }

  async getPendingCount(): Promise<number> {
    const items = await this.getPendingItems();
    return items.length;
  }

  async getQuarantinedCount(): Promise<number> {
    const items = await this.getQuarantinedItems();
    return items.length;
  }

  async getQueueMetrics(): Promise<{ pendingCount: number; quarantinedCount: number; isSyncing: boolean; authRequired: boolean }> {
    const all = await this.getAllItems();
    const pendingCount = all.filter((i) => i.status === "pending").length;
    const quarantinedCount = all.filter((i) => i.status === "quarantined").length;
    return {
      pendingCount,
      quarantinedCount,
      isSyncing: this.syncing,
      authRequired: this.authPaused,
    };
  }

  /**
   * Returns items ready for immediate synchronization.
   * Quarantined items are strictly excluded so they never block pending work.
   */
  async getPendingItems(): Promise<QueueItem[]> {
    const all = await this.getAllItems();
    // Recover any orphaned 'syncing' items left from interrupted Android app terminations
    if (!this.syncing) {
      for (const item of all) {
        if (item.status === "syncing") {
          item.status = "pending";
          await this.persist(item);
        } else if (item.status === "failed") {
          // Normalize legacy failed items into quarantined state to prevent infinite retry loops
          await this.quarantineItem(item, {
            classification: "exhausted_retries",
            isRetryable: false,
            safeMessage: item.lastError || "Legacy failed item quarantined",
          });
        }
      }
    }
    return all.filter((item) => item.status === "pending");
  }

  async getQuarantinedItems(): Promise<QueueItem[]> {
    const all = await this.getAllItems();
    return all.filter((item) => item.status === "quarantined");
  }

  async getAllItems(): Promise<QueueItem[]> {
    const raw = isIndexedDBAvailable()
      ? await idbGetAll<QueueItem>("queue")
      : this.readFallback();

    const items: QueueItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;

      // Check for corrupted queue item structure
      if (!item.id || !item.url || !item.type) {
        const itemId = item.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const corruptedItem: QueueItem = {
          id: itemId,
          type: (item.type as any) || "staff_attendance",
          label: item.label || "Corrupted Item",
          url: item.url || "/api/corrupted",
          method: item.method || "POST",
          headers: item.headers || {},
          body: item.body || "",
          createdAt: item.createdAt || now,
          retries: MAX_RETRY_ATTEMPTS,
          status: "quarantined",
          dlq: {
            originalQueueId: itemId,
            operationType: (item.type as any) || "staff_attendance",
            entityRef: item.id ? `corrupted:${item.id}` : "corrupted",
            payload: null,
            classification: "corrupted",
            safeErrorMessage: "Item corrupted in local storage (missing url or type)",
            attempts: item.retries || 0,
            firstFailedAt: item.firstFailedAt || now,
            lastFailedAt: now,
            quarantinedAt: now,
            recoveryStatus: "quarantined",
          },
        };
        items.push(corruptedItem);
        void this.persist(corruptedItem);
        continue;
      }

      // Quarantined items are preserved in storage and returned for DLQ inspection
      if (item.status === "quarantined") {
        items.push(item);
        continue;
      }

      if (canQueueOfflineOperation(item.type, item.url)) {
        items.push(item);
      }
    }
    return items;
  }

  async enqueue(item: Omit<QueueItem, "id" | "createdAt" | "retries" | "status">): Promise<QueueItem> {
    if (!canQueueOfflineOperation(item.type, item.url)) {
      throw new Error(SERVER_CONFIRMATION_REQUIRED_MESSAGE);
    }

    // Duplicate upload prevention: check if identical item is already pending or syncing
    const all = await this.getAllItems();
    const existing = all.find(
      (existingItem) =>
        (existingItem.status === "pending" || existingItem.status === "syncing") &&
        existingItem.type === item.type &&
        existingItem.url === item.url &&
        existingItem.body === item.body,
    );
    if (existing) {
      return existing;
    }

    const { staffId: activeStaffId, userId: activeUserId } = getActiveStaffIdentity();

    const entry: QueueItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      retries: 0,
      status: "pending",
      staffId: item.staffId !== undefined ? item.staffId : activeStaffId,
      userId: item.userId !== undefined ? item.userId : activeUserId,
    };

    await this.persist(entry);
    this.emit();
    return entry;
  }

  async processQueue(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    if (!connectivityService.canExecuteWrites() || this.authPaused) return;

    this.syncPromise = this.runSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  /**
   * Resumes queue processing following an authentication recovery / refresh.
   */
  async resumeAuthQueue(): Promise<void> {
    this.authPaused = false;
    this.emit();
    return this.processQueue();
  }

  /**
   * Restores a quarantined item to the active queue for a manual retry.
   */
  async retryQuarantinedItem(id: string): Promise<boolean> {
    const all = await this.getAllItems();
    const item = all.find((x) => x.id === id);
    if (!item || item.status !== "quarantined") return false;

    item.status = "pending";
    item.retries = 0;
    if (item.dlq) {
      item.dlq.recoveryStatus = "recovering";
    }
    await this.persist(item);
    this.emit();
    await this.processQueue();
    return true;
  }

  /**
   * Retries all currently quarantined items.
   */
  async retryAllQuarantined(): Promise<number> {
    const quarantined = await this.getQuarantinedItems();
    for (const item of quarantined) {
      item.status = "pending";
      item.retries = 0;
      if (item.dlq) item.dlq.recoveryStatus = "recovering";
      await this.persist(item);
    }
    this.emit();
    if (quarantined.length > 0) {
      await this.processQueue();
    }
    return quarantined.length;
  }

  /**
   * Permanently discards a quarantined item upon staff confirmation.
   */
  async discardQuarantinedItem(id: string): Promise<boolean> {
    const all = await this.getAllItems();
    const item = all.find((x) => x.id === id);
    if (!item) return false;
    await this.removeItem(id);
    this.emit();
    return true;
  }

  /**
   * Quarantines a permanently invalid or retry-exhausted queue item into the DLQ.
   */
  private async quarantineItem(
    item: QueueItem,
    classification: ReturnType<typeof classifySyncError>,
  ): Promise<void> {
    const now = new Date().toISOString();

    // Sanitize headers: remove authorization tokens before saving in DLQ
    const sanitizedHeaders = { ...item.headers };
    delete sanitizedHeaders["Authorization"];
    delete sanitizedHeaders["authorization"];

    const dlqRecord: DeadLetterRecord = {
      originalQueueId: item.id,
      operationType: item.type,
      entityRef: extractEntityRef(item),
      payload: item.body,
      classification: classification.classification,
      httpStatus: classification.httpStatus ?? null,
      safeErrorMessage: classification.safeMessage,
      attempts: item.retries,
      firstFailedAt: item.firstFailedAt ?? now,
      lastFailedAt: now,
      quarantinedAt: now,
      recoveryStatus: "quarantined",
    };

    item.status = "quarantined";
    item.lastError = classification.safeMessage;
    item.lastFailedAt = now;
    if (!item.firstFailedAt) item.firstFailedAt = now;
    item.dlq = dlqRecord;
    item.headers = sanitizedHeaders;

    await this.persist(item);
  }

  private async runSync(): Promise<void> {
    const pending = await this.getPendingItems();
    if (pending.length === 0) return;

    const { staffId: activeStaffId } = getActiveStaffIdentity();

    this.syncing = true;
    this.emit();

    for (const item of pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (!connectivityService.canExecuteWrites() || this.authPaused) break;

      // Corrupted queue item check
      if (!item.url || !item.method || !item.type) {
        await this.quarantineItem(item, {
          classification: "corrupted",
          isRetryable: false,
          safeMessage: "Queue item payload or URL is corrupted and cannot be sent.",
        });
        continue;
      }

      if (!canQueueOfflineOperation(item.type, item.url)) {
        await this.removeItem(item.id);
        continue;
      }

      // STAFF-077 / STAFF-078: Cross-staff queue isolation on shared devices.
      if (item.staffId != null && activeStaffId != null && item.staffId !== activeStaffId) {
        continue;
      }

      item.status = "syncing";
      await this.persist(item);

      let response: Response | null = null;
      try {
        if (item.type === "staff_photo") {
          const { processStaffPhotoQueueItem } = await import("./staffPhotoQueue");
          await processStaffPhotoQueueItem(item);
        } else {
          response = await fetchWithRetry(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body,
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        }

        // Successfully synced
        await this.removeItem(item.id);
        connectivityService.markSyncSuccess();
      } catch (err) {
        const errorInfo = classifySyncError(err, response, item.type);

        // 1. HTTP 401 Unauthorized: Pause queue, do not burn retries or delete
        if (errorInfo.classification === "auth_required") {
          this.authPaused = true;
          item.status = "pending";
          item.lastError = errorInfo.safeMessage;
          await this.persist(item);
          break; // Stop further syncing until auth renewal
        }

        // 2. HTTP 409 Conflict: check if workflow completed already
        if (errorInfo.classification === "conflict") {
          if (handleConflictResponse(item, err)) {
            await this.removeItem(item.id);
            connectivityService.markSyncSuccess();
            continue;
          }
          // Genuine conflict: quarantine to DLQ
          await this.quarantineItem(item, errorInfo);
          continue;
        }

        // 3. Permanent validation, forbidden, not found, or client errors: quarantine immediately to DLQ
        if (!errorInfo.isRetryable) {
          await this.quarantineItem(item, errorInfo);
          continue;
        }

        // 4. Retryable network or server errors: bound retries
        item.retries += 1;
        const now = new Date().toISOString();
        item.lastFailedAt = now;
        if (!item.firstFailedAt) item.firstFailedAt = now;
        item.lastError = errorInfo.safeMessage;

        if (item.retries >= MAX_RETRY_ATTEMPTS) {
          await this.quarantineItem(item, {
            classification: "exhausted_retries",
            isRetryable: false,
            httpStatus: errorInfo.httpStatus,
            safeMessage: `Max retries (${MAX_RETRY_ATTEMPTS}) exceeded: ${errorInfo.safeMessage}`,
          });
        } else {
          item.status = "pending";
          await this.persist(item);
        }
      }
    }

    this.syncing = false;
    this.emit();
  }

  private async removeItem(id: string): Promise<void> {
    if (isIndexedDBAvailable()) {
      await idbDelete("queue", id);
    }
    this.removeFromFallback(id);
  }

  private async persist(item: QueueItem): Promise<void> {
    if (isIndexedDBAvailable()) {
      await idbPut("queue", item);
      return;
    }
    const all = this.readFallback();
    const idx = all.findIndex((x) => x.id === item.id);
    if (idx >= 0) all[idx] = item;
    else all.push(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  private readFallback(): QueueItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueueItem[]) : [];
    } catch {
      return [];
    }
  }

  private removeFromFallback(id: string): void {
    const all = this.readFallback().filter((x) => x.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  private emit(): void {
    void this.getQueueMetrics().then((metrics) => {
      for (const listener of this.listeners) {
        listener(metrics.pendingCount, this.syncing, {
          quarantinedCount: metrics.quarantinedCount,
          authRequired: this.authPaused,
        });
      }
    });
  }
}

export const offlineQueue = new OfflineQueueService();
