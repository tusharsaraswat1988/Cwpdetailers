import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SidebarRenderProps } from "./PanelShell";
import {
  LogOut, Menu, PanelLeftOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { useBranding } from "@/lib/branding";
import { AdminNavMenu } from "./AdminNavMenu";

export default function AdminSidebar({ onNavigate, embedded = false, className }: SidebarRenderProps & { className?: string }) {
  const [, setLocation] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const branding = useBranding();
  const collapsed = useAppStore(s => s.sidebarCollapsed);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const showCollapsed = collapsed && !embedded;

  return (
    <aside
      data-testid="admin-sidebar"
      className={cn(
        "flex flex-col h-full bg-secondary transition-all duration-300 border-r border-white/5 overflow-y-auto",
        embedded ? "w-full border-r-0" : showCollapsed ? "w-16" : "w-60",
        className,
      )}
    >
      <div
        className={cn(
          "border-b border-white/10",
          showCollapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "flex items-center gap-3 px-4 py-5",
        )}
      >
        {showCollapsed ? (
          <>
            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              data-testid="sidebar-expand-toggle"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
            <BrandLogo variant="favicon" lazy={false} />
          </>
        ) : (
          <>
            <BrandLogo variant="navbar" lazy={false} />
            <div className="min-w-0">
              <p className="text-white font-display font-bold text-sm leading-tight">{branding.brandName} Admin</p>
              <p className="text-white/40 text-xs truncate">{branding.tagline ?? "Operations Hub"}</p>
              <SyncStatusIndicator className="mt-1.5 text-white/50" />
            </div>
            <button
              onClick={toggleSidebar}
              className="ml-auto text-white/40 hover:text-white transition-colors"
              data-testid="sidebar-collapse-toggle"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <Menu size={14} />
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        <AdminNavMenu
          onNavigate={onNavigate}
          hasPermission={hasPermission}
          collapsed={showCollapsed}
        />
      </nav>

      <div className="border-t border-white/10 p-3">
        {!showCollapsed && user && (
          <div className="px-2 py-1 mb-2">
            <p className="text-white text-xs font-medium truncate">{user.name}</p>
            <p className="text-white/40 text-xs capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={() => {
            logout();
            setLocation("/admin/login");
            onNavigate?.();
          }}
          data-testid="btn-logout"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          <LogOut size={14} />
          {!showCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
