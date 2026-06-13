import { ReactNode } from "react";
import PanelShell from "./PanelShell";
import AdminSidebar from "./AdminSidebar";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { useBrandingPortal } from "@/lib/branding";
import { useMediaQuery } from "@/lib/useMediaQuery";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const branding = useBrandingPortal("admin");

  return (
    <PanelShell
      testId="admin-layout"
      mobileTitle={`${branding.brandName} Admin`}
      sidebar={(props) => <AdminSidebar {...props} />}
    >
      {isMobile && (
        <PwaInstallBanner
          portalKey="admin"
          title={`Install ${branding.brandName} Admin`}
          description="Add the admin console to your home screen for mobile operations access."
        />
      )}
      {children}
    </PanelShell>
  );
}
