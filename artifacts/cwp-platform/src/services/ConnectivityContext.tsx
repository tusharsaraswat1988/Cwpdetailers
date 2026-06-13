import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  connectivityService,
  type ConnectivitySnapshot,
  type ConnectivityState,
} from "./connectivityService";
import { offlineQueue } from "./offlineQueue";

type ConnectivityContextValue = ConnectivitySnapshot & {
  pendingQueueCount: number;
  isSyncing: boolean;
  refresh: () => Promise<boolean>;
  processQueue: () => Promise<void>;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(() => connectivityService.getSnapshot());
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    connectivityService.start();
    const unsubConnectivity = connectivityService.subscribe(setSnapshot);
    const unsubQueue = offlineQueue.subscribe((count, syncing) => {
      setPendingQueueCount(count);
      setIsSyncing(syncing);
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
      isSyncing,
      refresh: () => connectivityService.checkBackend({ forceRecovering: true }),
      processQueue: () => offlineQueue.processQueue(),
    }),
    [snapshot, pendingQueueCount, isSyncing],
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
