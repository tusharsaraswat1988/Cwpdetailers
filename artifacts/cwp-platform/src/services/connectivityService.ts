export type ConnectivityState = "online" | "offline" | "server_unavailable" | "recovering";

export type ConnectivitySnapshot = {
  state: ConnectivityState;
  browserOnline: boolean;
  backendAvailable: boolean;
  lastSuccessfulSync: string | null;
  lastCheckedAt: string | null;
};

type Listener = (snapshot: ConnectivitySnapshot) => void;

const HEALTH_PATH = "/api/healthz";
const HEALTH_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 45_000;
const RECOVERING_GRACE_MS = 5_000;

class ConnectivityService {
  private state: ConnectivityState = "online";
  private browserOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private backendAvailable = true;
  private lastSuccessfulSync: string | null = null;
  private lastCheckedAt: string | null = null;
  private listeners = new Set<Listener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private recoveringTimer: ReturnType<typeof setTimeout> | null = null;
  private checkInFlight = false;
  private started = false;

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    window.addEventListener("online", this.handleBrowserOnline);
    window.addEventListener("offline", this.handleBrowserOffline);

    void this.checkBackend({ reason: "startup" });
    this.pollTimer = setInterval(() => {
      void this.checkBackend({ reason: "poll" });
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.started || typeof window === "undefined") return;
    this.started = false;
    window.removeEventListener("online", this.handleBrowserOnline);
    window.removeEventListener("offline", this.handleBrowserOffline);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.recoveringTimer) clearTimeout(this.recoveringTimer);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ConnectivitySnapshot {
    return {
      state: this.state,
      browserOnline: this.browserOnline,
      backendAvailable: this.backendAvailable,
      lastSuccessfulSync: this.lastSuccessfulSync,
      lastCheckedAt: this.lastCheckedAt,
    };
  }

  async checkBackend(options?: { reason?: string; forceRecovering?: boolean }): Promise<boolean> {
    if (this.checkInFlight) return this.backendAvailable;
    this.checkInFlight = true;

    this.browserOnline = navigator.onLine;
    this.lastCheckedAt = new Date().toISOString();

    if (!this.browserOnline) {
      this.backendAvailable = false;
      this.setState("offline");
      this.checkInFlight = false;
      return false;
    }

    if (options?.forceRecovering || this.state === "offline" || this.state === "server_unavailable") {
      this.setState("recovering");
    }

    try {
      const res = await fetch(HEALTH_PATH, {
        cache: "no-store",
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });

      if (res.ok) {
        this.backendAvailable = true;
        this.lastSuccessfulSync = new Date().toISOString();
        this.setState("online");
        this.checkInFlight = false;
        return true;
      }

      this.backendAvailable = false;
      this.setState("server_unavailable");
    } catch {
      this.backendAvailable = false;
      this.setState(this.browserOnline ? "server_unavailable" : "offline");
    }

    this.checkInFlight = false;
    return false;
  }

  markSyncSuccess(): void {
    this.lastSuccessfulSync = new Date().toISOString();
    if (this.browserOnline) {
      this.backendAvailable = true;
      this.setState("online");
    }
  }

  canExecuteWrites(): boolean {
    return this.state === "online" && this.browserOnline && this.backendAvailable;
  }

  private handleBrowserOnline = (): void => {
    this.browserOnline = true;
    this.setState("recovering");
    void this.checkBackend({ reason: "browser-online", forceRecovering: true });
  };

  private handleBrowserOffline = (): void => {
    this.browserOnline = false;
    this.backendAvailable = false;
    this.setState("offline");
  };

  private setState(next: ConnectivityState): void {
    if (this.recoveringTimer) {
      clearTimeout(this.recoveringTimer);
      this.recoveringTimer = null;
    }

    if (next === "recovering") {
      this.recoveringTimer = setTimeout(() => {
        if (this.state === "recovering" && !this.backendAvailable && this.browserOnline) {
          this.setState("server_unavailable");
        }
      }, RECOVERING_GRACE_MS);
    }

    if (this.state === next) {
      this.emit();
      return;
    }

    this.state = next;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const connectivityService = new ConnectivityService();
