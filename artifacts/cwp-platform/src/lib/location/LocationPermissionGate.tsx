import { ReactNode } from "react";
import { Loader2, MapPin, MapPinOff, Navigation, RefreshCw, Settings, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStaffLocation } from "./LocationProvider";
import { useAuth } from "@/lib/auth";

/**
 * Blocks staff UI only when location permission is missing, denied, or GPS is off.
 * Does NOT block navigation while GPS fix is acquired in the background.
 */
export function LocationPermissionGate({ children }: { children: ReactNode }) {
  const {
    permissionState,
    isPermanentlyDenied,
    resolutionDeclined,
    errorMessage,
    isRefreshing,
    requestPermission,
    enableDeviceLocation,
    openLocationSettings,
    openAppSettings,
  } = useStaffLocation();
  const { logout } = useAuth();

  const canEnterApp = permissionState === "granted";

  const renderIcon = () => {
    if (permissionState === "unsupported") {
      return <ShieldAlert className="text-destructive" size={22} />;
    }
    if (permissionState === "location_off") {
      return <MapPinOff className="text-amber-500" size={22} />;
    }
    if (permissionState === "denied") {
      return <ShieldAlert className="text-destructive" size={22} />;
    }
    return <MapPin className="text-primary" size={22} />;
  };

  const renderTitle = () => {
    switch (permissionState) {
      case "unsupported":
        return "GPS not supported";
      case "location_off":
        return "Device Location band hai";
      case "denied":
        return isPermanentlyDenied ? "Location permission blocked" : "Location blocked";
      default:
        return "Location on karein";
    }
  };

  const renderDescription = () => {
    switch (permissionState) {
      case "unsupported":
        return "Is device par GPS nahi hai. Android phone se staff app use karein.";
      case "location_off":
        return "Attendance aur visit proof ke liye device ka GPS/Location on hona zaroori hai. Turn on GPS dabayein.";
      case "denied":
        return isPermanentlyDenied
          ? "Staff app ke liye location permission blocked hai. Phone Settings me jaakar Location allow karein."
          : "Attendance aur visit proof ke liye Precise location zaroori hai.";
      case "prompt":
      case "checking":
      default:
        return "Allow karein — punch aur job start ke liye accurate GPS chahiye.";
    }
  };

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
              {renderIcon()}
            </div>

            <h2 className="font-display mb-1 text-base font-bold">
              {renderTitle()}
            </h2>

            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {renderDescription()}
            </p>

            {errorMessage && (
              <p
                className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-left text-[11px] text-destructive leading-tight"
                data-testid="location-gate-error"
              >
                {errorMessage}
              </p>
            )}

            {permissionState !== "unsupported" && (
              <ul className="mb-4 space-y-1.5 rounded-xl border bg-muted/40 p-3 text-left text-[11px] text-muted-foreground">
                <li className="flex gap-2">
                  <Navigation size={12} className="mt-0.5 shrink-0 text-primary" />
                  Permission: Precise location / Allow while using
                </li>
                <li className="flex gap-2">
                  <Navigation size={12} className="mt-0.5 shrink-0 text-primary" />
                  Device GPS toggle on rakhein
                </li>
                <li className="flex gap-2">
                  <Navigation size={12} className="mt-0.5 shrink-0 text-primary" />
                  Open sky ke paas khade ho — indoor GPS weak hota hai
                </li>
              </ul>
            )}

            {permissionState === "location_off" && (
              <div className="space-y-2">
                <Button
                  className="h-10 w-full font-semibold"
                  onClick={() => void enableDeviceLocation()}
                  disabled={isRefreshing}
                  data-testid="btn-enable-location"
                >
                  {isRefreshing ? (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  ) : (
                    <RefreshCw size={14} className="mr-2" />
                  )}
                  {isRefreshing ? "Turning on GPS…" : "Turn on GPS"}
                </Button>

                <Button
                  variant="outline"
                  className="h-10 w-full font-medium text-xs"
                  onClick={() => void openLocationSettings()}
                  data-testid="btn-open-location-settings"
                >
                  <Settings size={14} className="mr-2" />
                  Open Location Settings
                </Button>
              </div>
            )}

            {permissionState === "denied" && isPermanentlyDenied && (
              <div className="space-y-2">
                <Button
                  className="h-10 w-full font-semibold"
                  onClick={() => void openAppSettings()}
                  data-testid="btn-open-app-settings"
                >
                  <Settings size={14} className="mr-2" />
                  Open App Settings
                </Button>

                <Button
                  variant="outline"
                  className="h-10 w-full font-medium text-xs"
                  onClick={() => void requestPermission()}
                  disabled={isRefreshing}
                  data-testid="btn-enable-location"
                >
                  <RefreshCw size={14} className="mr-2" />
                  {isRefreshing ? "Checking…" : "Try again"}
                </Button>
              </div>
            )}

            {permissionState === "denied" && !isPermanentlyDenied && (
              <Button
                className="h-10 w-full font-semibold"
                onClick={() => void requestPermission()}
                disabled={isRefreshing}
                data-testid="btn-enable-location"
              >
                {isRefreshing ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <RefreshCw size={14} className="mr-2" />
                )}
                {isRefreshing ? "Checking…" : "Try again"}
              </Button>
            )}

            {(permissionState === "prompt" || permissionState === "checking") && (
              <Button
                className="h-10 w-full font-semibold"
                onClick={() => void requestPermission()}
                disabled={isRefreshing}
                data-testid="btn-enable-location"
              >
                {isRefreshing ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <RefreshCw size={14} className="mr-2" />
                )}
                {isRefreshing ? "Requesting…" : "Enable location"}
              </Button>
            )}

            <Button
              variant="ghost"
              className="h-9 w-full text-xs text-muted-foreground hover:text-destructive mt-3"
              onClick={() => logout("staff")}
              data-testid="gate-logout-btn"
            >
              <LogOut size={13} className="mr-1.5" />
              Log out
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** @deprecated Use LocationPermissionGate */
export { LocationPermissionGate as LocationGate };
