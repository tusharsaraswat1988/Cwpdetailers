import { ReactNode } from "react";
import { MapPin, Navigation, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStaffLocation } from "./LocationProvider";

/**
 * Blocks staff UI only when location permission is missing or denied.
 * Does NOT block navigation while GPS fix is acquired in the background.
 */
export function LocationPermissionGate({ children }: { children: ReactNode }) {
  const { permissionState, requestPermission } = useStaffLocation();

  const canEnterApp = permissionState === "granted";

  return (
    <>
      {children}
      {!canEnterApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/50 backdrop-blur-[1px]"
          data-testid="location-permission-gate"
        >
          <div className="w-full max-w-xs rounded-2xl border border-border bg-background p-5 shadow-lg text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              {permissionState === "unsupported" ? (
                <ShieldAlert className="text-destructive" size={22} />
              ) : (
                <MapPin className="text-primary" size={22} />
              )}
            </div>

            <h2 className="font-display mb-1 text-base font-bold">
              {permissionState === "unsupported"
                ? "GPS not supported"
                : permissionState === "denied"
                  ? "Location blocked"
                  : "Location on karein"}
            </h2>

            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              {permissionState === "unsupported" &&
                "Is device par GPS nahi hai. Android phone se staff app use karein."}
              {permissionState === "denied" &&
                "Attendance aur visit proof ke liye location zaroori hai."}
              {(permissionState === "prompt" || permissionState === "checking") &&
                "Allow karein — field work ke liye live GPS chahiye."}
            </p>

            {permissionState !== "unsupported" && (
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

            {permissionState !== "unsupported" && (
              <Button
                className="h-10 w-full font-semibold"
                onClick={() => void requestPermission()}
                data-testid="btn-enable-location"
              >
                <RefreshCw size={14} className="mr-2" />
                {permissionState === "denied" ? "Try again" : "Enable location"}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** @deprecated Use LocationPermissionGate */
export { LocationPermissionGate as LocationGate };
