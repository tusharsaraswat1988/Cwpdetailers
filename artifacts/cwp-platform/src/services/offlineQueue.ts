import { idbDelete, idbGetAll, idbPut, isIndexedDBAvailable } from "./idb";
import { fetchWithRetry } from "./apiRetry";
import { connectivityService } from "./connectivityService";
import {
  canQueueOfflineOperation,
  type QueueOperationType,
  SERVER_CONFIRMATION_REQUIRED_MESSAGE,
} from "./offlineQueuePolicy";

export type { QueueOperationType } from "./offlineQueuePolicy";

export type QueueItemStatus = "pending" | "syncing" | "failed";

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
};

type QueueListener = (pendingCount: number, syncing: boolean) => void;

const STORAGE_KEY = "cwp_offline_queue_fallback";

class OfflineQueueService {
  private listeners = new Set<QueueListener>();
  private syncing = false;
  private syncPromise: Promise<void> | null = null;

  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    void this.getPendingCount().then((count) => listener(count, this.syncing));
    return () => this.listeners.delete(listener);
  }

  isSyncing(): boolean {
    return this.syncing;
  }

  async getPendingCount(): Promise<number> {
    const items = await this.getPendingItems();
    return items.length;
  }

  async getPendingItems(): Promise<QueueItem[]> {
    const all = await this.getAllItems();
    return all.filter((item) => item.status === "pending" || item.status === "failed");
  }

  async getAllItems(): Promise<QueueItem[]> {
    const raw = isIndexedDBAvailable()
      ? await idbGetAll<QueueItem>("queue")
      : this.readFallback();
    return raw.filter((item) => canQueueOfflineOperation(item.type, item.url));
  }

  async enqueue(item: Omit<QueueItem, "id" | "createdAt" | "retries" | "status">): Promise<QueueItem> {
    if (!canQueueOfflineOperation(item.type, item.url)) {
      throw new Error(SERVER_CONFIRMATION_REQUIRED_MESSAGE);
    }

    const entry: QueueItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      retries: 0,
      status: "pending",
    };

    await this.persist(entry);
    this.emit();
    return entry;
  }

  async processQueue(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    if (!connectivityService.canExecuteWrites()) return;

    this.syncPromise = this.runSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async runSync(): Promise<void> {
    const pending = await this.getPendingItems();
    if (pending.length === 0) return;

    this.syncing = true;
    this.emit();

    for (const item of pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (!connectivityService.canExecuteWrites()) break;
      if (!canQueueOfflineOperation(item.type, item.url)) {
        await this.removeItem(item.id);
        continue;
      }

      item.status = "syncing";
      await this.persist(item);

      try {
        const res = await fetchWithRetry(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        await this.removeItem(item.id);
        connectivityService.markSyncSuccess();
      } catch (err) {
        item.retries += 1;
        item.status = item.retries >= 3 ? "failed" : "pending";
        item.lastError = err instanceof Error ? err.message : "Sync failed";
        await this.persist(item);
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
    void this.getPendingCount().then((count) => {
      for (const listener of this.listeners) listener(count, this.syncing);
    });
  }
}

export const offlineQueue = new OfflineQueueService();
