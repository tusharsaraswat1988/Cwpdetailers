import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  connectivityService,
  type ConnectivitySnapshot,
  type ConnectivityState,
} from "./connectivityService";
import { offlineQueue } from "./offlineQueue";

type ConnectivityContextValue = ConnectivitySnapshot & {
  pendingQueueCount: number;
  quarantinedCount: number;
  isSyncing: boolean;
  authRequired: boolean;
  refresh: () => Promise<boolean>;
  processQueue: () => Promise<void>;
  retryQuarantined: (id?: string) => Promise<boolean | number>;
  discardQuarantined: (id: string) => Promise<boolean>;
  resumeAuthQueue: () => Promise<void>;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(() => connectivityService.getSnapshot());
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [quarantinedCount, setQuarantinedCount] = useState(0);
  const [authRequired, setAuthRequired] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    connectivityService.start();
    const unsubConnectivity = connectivityService.subscribe(setSnapshot);
    const unsubQueue = offlineQueue.subscribe((count, syncing, details) => {
      setPendingQueueCount(count);
      setIsSyncing(syncing);
      if (details) {
        setQuarantinedCount(details.quarantinedCount);
        setAuthRequired(details.authRequired);
      }
    });

    return () => {
      unsubConnectivity();
      unsubQueue();
      connectivityService.stop();
    };
  }, []);

  useEffect(() => {
    if (snapshot.state === "online") {
      void offlineQueue.processQueue();
    }
  }, [snapshot.state]);

  const value = useMemo<ConnectivityContextValue>(
    () => ({
      ...snapshot,
      pendingQueueCount,
      quarantinedCount,
      isSyncing,
      authRequired,
      refresh: () => connectivityService.checkBackend({ forceRecovering: true }),
      processQueue: () => offlineQueue.processQueue(),
      retryQuarantined: (id?: string) => (id ? offlineQueue.retryQuarantinedItem(id) : offlineQueue.retryAllQuarantined()),
      discardQuarantined: (id: string) => offlineQueue.discardQuarantinedItem(id),
      resumeAuthQueue: () => offlineQueue.resumeAuthQueue(),
    }),
    [snapshot, pendingQueueCount, quarantinedCount, isSyncing, authRequired],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityContextValue {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error("useConnectivity must be used within ConnectivityProvider");
  }
  return ctx;
}

export function useConnectivityState(): ConnectivityState {
  return useConnectivity().state;
}
