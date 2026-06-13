import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { WifiOff } from "lucide-react";

async function verifyConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const res = await fetch("/api/healthz", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function OfflineScreen() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const online = await verifyConnectivity();
      if (!cancelled) setIsOffline(!online);
    };

    void sync();

    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      void verifyConnectivity().then((online) => {
        if (!cancelled) setIsOffline(!online);
      });
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const retry = useCallback(() => {
    void verifyConnectivity().then((online) => {
      if (online) window.location.reload();
      else setIsOffline(true);
    });
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6 safe-area-top safe-area-bottom"
      data-testid="offline-screen"
    >
      <div className="max-w-sm w-full text-center">
        <div className="inline-flex items-center justify-center mb-5">
          <BrandLogo variant="full" imgClassName="h-16 max-w-[200px]" fallbackClassName="w-16 h-16" lazy={false} />
        </div>
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-4 -mt-2">
          <WifiOff size={18} className="text-muted-foreground" />
        </div>
        <h1 className="font-display font-bold text-xl mb-2">Connection lost</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          You&apos;re offline. Check your internet connection and try again. Live bookings, wallet,
          and billing require an active connection.
        </p>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[10rem]"
          onClick={retry}
          data-testid="offline-retry-button"
        >
          Retry
        </Button>
      </div>
    </div>
  );
}
