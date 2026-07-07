import { ReactNode } from "react";
import { LocationProvider } from "@/lib/location/LocationProvider";
import { LocationPermissionGate } from "@/lib/location/LocationPermissionGate";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffJobAlertLayer } from "@/components/staff/StaffJobAlertLayer";

/**
 * Single staff shell — stays mounted across all /staff/* navigation.
 * LocationProvider lives here so GPS state is never recreated per page.
 */
export function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <LocationProvider>
      <StaffAppShell>
        <LocationPermissionGate>
          <StaffJobAlertLayer>{children}</StaffJobAlertLayer>
        </LocationPermissionGate>
      </StaffAppShell>
    </LocationProvider>
  );
}

export default StaffLayout;
