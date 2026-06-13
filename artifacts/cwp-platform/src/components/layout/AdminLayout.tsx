import { ReactNode } from "react";
import PanelShell from "./PanelShell";
import AdminSidebar from "./AdminSidebar";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { usePortalManifest } from "@/lib/pwa/usePortalManifest";
import { useMediaQuery } from "@/lib/useMediaQuery";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  usePortalManifest("/manifest-admin.json", "#00cccc");

  return (
    <PanelShell
      testId="admin-layout"
      mobileTitle="CWP Admin"
      sidebar={(props) => <AdminSidebar {...props} />}
    >
      {isMobile && (
        <PwaInstallBanner
          portalKey="admin"
          title="Install CWP Admin"
          description="Add the admin console to your home screen for mobile operations access."
        />
      )}
      {children}
    </PanelShell>
  );
}
