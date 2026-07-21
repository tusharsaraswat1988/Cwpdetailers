import { ReactNode } from "react";
import { LocationProvider } from "@/lib/location/LocationProvider";
import { LocationPermissionGate } from "@/lib/location/LocationPermissionGate";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffJobAlertLayer } from "@/components/staff/StaffJobAlertLayer";
import { StaffThemeRoot } from "@/features/staff-ds";

/**
 * Single staff shell — stays mounted across all /staff/* navigation.
 * LocationProvider lives here so GPS state is never recreated per page.
 * StaffThemeRoot applies Platform brand + field-workforce density tokens.
 */
export function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <StaffThemeRoot>
      <LocationProvider>
        <StaffAppShell>
          <LocationPermissionGate>
            <StaffJobAlertLayer>{children}</StaffJobAlertLayer>
          </LocationPermissionGate>
        </StaffAppShell>
      </LocationProvider>
    </StaffThemeRoot>
  );
}

export default StaffLayout;
