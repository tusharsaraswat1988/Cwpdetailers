import { useEffect, useMemo, useState } from "react";
import { X, WifiOff, ServerCrash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConnectivity } from "@/services/ConnectivityContext";
import type { ConnectivityState } from "@/services/connectivityService";

const DISMISS_KEY = "cwp_connectivity_banner_dismissed";

const BANNER_COPY: Record<
  Exclude<ConnectivityState, "online">,
  { title: string; description: string; icon: typeof WifiOff; tone: string }
> = {
  offline: {
    title: "No Internet Connection",
    description: "Changes will sync when internet returns.",
    icon: WifiOff,
    tone: "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100",
  },
  server_unavailable: {
    title: "Server is temporarily unavailable",
    description: "Some actions may fail. You can still browse the app.",
    icon: ServerCrash,
    tone: "bg-orange-500/10 border-orange-500/30 text-orange-950 dark:text-orange-100",
  },
  recovering: {
    title: "Starting server… this may take a few seconds",
    description: "Your pages stay accessible while we reconnect.",
    icon: Loader2,
    tone: "bg-primary/10 border-primary/30 text-foreground",
  },
};

export function ConnectivityBanner({ className }: { className?: string }) {
  const { state, refresh } = useConnectivity();
  const [dismissedState, setDismissedState] = useState<string | null>(() =>
    sessionStorage.getItem(DISMISS_KEY),
  );

  useEffect(() => {
    if (state === "online") {
      sessionStorage.removeItem(DISMISS_KEY);
      setDismissedState(null);
    }
  }, [state]);

  const visible = useMemo(() => {
    if (state === "online") return false;
    if (state === "recovering") return true;
    return dismissedState !== state;
  }, [state, dismissedState]);

  if (!visible || state === "online") return null;

  const copy = BANNER_COPY[state];
  const Icon = copy.icon;

  return (
    <div
      className={cn(
        "w-full border-b px-4 py-2.5 flex items-start gap-3 shrink-0",
        copy.tone,
        className,
      )}
      role="status"
      data-testid="connectivity-banner"
      data-state={state}
    >
      <Icon
        size={16}
        className={cn("mt-0.5 shrink-0", state === "recovering" && "animate-spin")}
      />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium leading-tight">{copy.title}</p>
        <p className="text-xs opacity-80 mt-0.5">{copy.description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {state !== "recovering" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void refresh()}
          >
            Retry
          </Button>
        )}
        {state !== "recovering" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Dismiss connectivity banner"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, state);
              setDismissedState(state);
            }}
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}

export default ConnectivityBanner;
