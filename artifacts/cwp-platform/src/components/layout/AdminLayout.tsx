import { ReactNode } from "react";
import PanelShell from "./PanelShell";
import AdminSidebar from "./AdminSidebar";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { useBrandingPortal } from "@/lib/branding";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useAppStore } from "@/lib/store";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

function CollapsedSidebarExpandButton() {
  const collapsed = useAppStore(s => s.sidebarCollapsed);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);

  if (!collapsed) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="hidden lg:flex fixed left-[4.25rem] top-4 z-30 h-9 w-9 rounded-full shadow-md border-border bg-card text-foreground hover:bg-accent"
      onClick={toggleSidebar}
      aria-label="Expand sidebar"
      title="Expand sidebar"
      data-testid="sidebar-expand-fab"
    >
      <PanelLeftOpen size={16} />
    </Button>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const branding = useBrandingPortal("admin");

  return (
    <PanelShell
      testId="admin-layout"
      mobileTitle={`${branding.brandName} Admin`}
      sidebar={(props) => <AdminSidebar {...props} />}
    >
      <CollapsedSidebarExpandButton />
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
