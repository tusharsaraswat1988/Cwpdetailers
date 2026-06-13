import { idbDelete, idbGetAll, idbPut, isIndexedDBAvailable } from "./idb";
import { fetchWithRetry } from "./apiRetry";
import { connectivityService } from "./connectivityService";

export type QueueOperationType =
  | "booking"
  | "customer"
  | "expense"
  | "invoice"
  | "inventory"
  | "note";

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
    if (isIndexedDBAvailable()) {
      const all = await idbGetAll<QueueItem>("queue");
      return all.filter((item) => item.status === "pending" || item.status === "failed");
    }
    return this.readFallback().filter((item) => item.status === "pending" || item.status === "failed");
  }

  async getAllItems(): Promise<QueueItem[]> {
    if (isIndexedDBAvailable()) {
      return idbGetAll<QueueItem>("queue");
    }
    return this.readFallback();
  }

  async enqueue(item: Omit<QueueItem, "id" | "createdAt" | "retries" | "status">): Promise<QueueItem> {
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

        await idbDelete("queue", item.id);
        this.removeFromFallback(item.id);
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
