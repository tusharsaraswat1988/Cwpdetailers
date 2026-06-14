import { ReactNode } from "react";
import { MapPin, Navigation, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocationPermission } from "./useLocationPermission";

export function LocationGate({ children }: { children: ReactNode }) {
  const { state, refresh, isReady } = useLocationPermission();

  if (isReady) return <>{children}</>;

  const isChecking = state === "checking";

  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-10 text-center"
      data-testid="location-gate"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        {state === "unsupported" ? (
          <ShieldAlert className="text-destructive" size={28} />
        ) : (
          <MapPin className="text-primary" size={28} />
        )}
      </div>

      <h2 className="font-display font-bold text-xl mb-2">
        {state === "unsupported" ? "GPS not supported" : "Turn on location to continue"}
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {state === "unsupported" && "This device cannot access GPS. Use an Android phone with location services."}
        {state === "denied" && "Location is required for attendance, job updates, and customer service proof — same as Swiggy/Uber partner apps."}
        {(state === "prompt" || state === "checking") && "Allow location access when prompted. Field work, attendance, and job actions need your live GPS."}
      </p>

      {state !== "unsupported" && (
        <ul className="text-left text-xs text-muted-foreground space-y-2 max-w-xs mb-6 bg-muted/40 rounded-xl p-4 border">
          <li className="flex gap-2"><Navigation size={14} className="shrink-0 text-primary mt-0.5" />Install the Staff app to home screen (not browser tab)</li>
          <li className="flex gap-2"><Navigation size={14} className="shrink-0 text-primary mt-0.5" />Settings → Location → Allow while using app</li>
          <li className="flex gap-2"><Navigation size={14} className="shrink-0 text-primary mt-0.5" />Disable battery saver for this app if GPS fails</li>
        </ul>
      )}

      {state !== "unsupported" && (
        <Button
          className="w-full max-w-xs h-12 font-semibold"
          onClick={() => void refresh()}
          disabled={isChecking}
          data-testid="btn-enable-location"
        >
          <RefreshCw size={16} className={`mr-2 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? "Checking GPS…" : state === "denied" ? "Try again" : "Enable location"}
        </Button>
      )}
    </div>
  );
}
