import { ReactNode } from "react";
import { useLocation } from "wouter";
import PanelShell from "./PanelShell";
import AdminSidebar from "./AdminSidebar";
import BranchManagerLayout from "./BranchManagerLayout";
import { useBrandingPortal } from "@/lib/branding";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { AdminThemeRoot } from "@/features/admin-ds";
import { AdminScopeHeader } from "./AdminScopeHeader";

function CollapsedSidebarExpandButton() {
  const collapsed = useAppStore(s => s.sidebarCollapsed);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);

  if (!collapsed) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="hidden lg:flex fixed left-[4.25rem] top-4 z-30 h-9 w-9 rounded-full shadow-md border-border bg-card text-foreground hover:bg-accent admin-transition"
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
  const branding = useBrandingPortal("admin");
  const { user } = useAuth();
  const [location] = useLocation();

  // If viewing manager routes or logged in as a branch manager (and not on central admin page)
  const isBranchManagerScope =
    location.startsWith("/manager") ||
    (user?.role === "branch_manager" && !location.startsWith("/admin"));

  if (isBranchManagerScope) {
    return <BranchManagerLayout>{children}</BranchManagerLayout>;
  }

  return (
    <AdminThemeRoot className="h-full min-h-0 overflow-hidden">
      <PanelShell
        testId="admin-layout"
        mobileTitle={`${branding.brandName} Admin`}
        sidebar={(props) => <AdminSidebar {...props} />}
      >
        <CommandPalette />
        <CollapsedSidebarExpandButton />
        <div className="flex flex-col min-h-full">
          <AdminScopeHeader />
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </PanelShell>
    </AdminThemeRoot>
  );
}
