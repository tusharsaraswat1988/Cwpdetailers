import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, WifiOff } from "lucide-react";

export function OfflineScreen() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const retry = useCallback(() => {
    if (navigator.onLine) {
      window.location.reload();
    } else {
      setIsOffline(true);
    }
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6 safe-area-top safe-area-bottom"
      data-testid="offline-screen"
    >
      <div className="max-w-sm w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-5">
          <Sun size={28} className="text-white" />
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
