import { ReactNode } from "react";
import { Loader2, MapPin, Navigation, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocationPermission } from "./useLocationPermission";

export function LocationGate({ children }: { children: ReactNode }) {
  const { state, refresh, isReady, isVerifying } = useLocationPermission();

  return (
    <>
      {children}
      {!isReady && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/50 backdrop-blur-[1px]"
          data-testid="location-gate"
        >
          <div className="w-full max-w-xs rounded-2xl border border-border bg-background p-5 shadow-lg text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              {state === "unsupported" ? (
                <ShieldAlert className="text-destructive" size={22} />
              ) : isVerifying ? (
                <Loader2 className="animate-spin text-primary" size={22} />
              ) : (
                <MapPin className="text-primary" size={22} />
              )}
            </div>

            <h2 className="font-display mb-1 text-base font-bold">
              {state === "unsupported"
                ? "GPS not supported"
                : isVerifying
                  ? "GPS check ho raha hai…"
                  : "Location on karein"}
            </h2>

            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              {state === "unsupported" &&
                "Is device par GPS nahi hai. Android phone se staff app use karein."}
              {state === "denied" &&
                "Attendance aur visit proof ke liye location zaroori hai."}
              {(state === "prompt" || state === "checking") && !isVerifying &&
                "Prompt aane par Allow karein — field work ke liye live GPS chahiye."}
              {isVerifying && state !== "unsupported" &&
                "Thoda wait karein, location verify ho rahi hai."}
            </p>

            {state !== "unsupported" && state !== "checking" && !isVerifying && (
              <ul className="mb-4 space-y-1.5 rounded-xl border bg-muted/40 p-3 text-left text-[11px] text-muted-foreground">
                <li className="flex gap-2">
                  <Navigation size={12} className="mt-0.5 shrink-0 text-primary" />
                  App ko home screen par add karein
                </li>
                <li className="flex gap-2">
                  <Navigation size={12} className="mt-0.5 shrink-0 text-primary" />
                  Settings → Location → Allow while using
                </li>
              </ul>
            )}

            {state !== "unsupported" && !isVerifying && (
              <Button
                className="h-10 w-full font-semibold"
                onClick={() => void refresh()}
                data-testid="btn-enable-location"
              >
                <RefreshCw size={14} className="mr-2" />
                {state === "denied" ? "Try again" : "Enable location"}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
