import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { SidebarRenderProps } from "./PanelShell";
import {
  LayoutDashboard, Calendar, UserCog, LogOut,
  Bell, Funnel, Users,
} from "lucide-react";
import PanelShell from "./PanelShell";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding, useBrandingPortal } from "@/lib/branding";
import { useMediaQuery } from "@/lib/useMediaQuery";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: { resource: string; action: string };
};

const ALL_NAV: NavItem[] = [
  { href: "/franchisee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/franchisee/customers", label: "Customers", icon: Users, permission: { resource: "customers", action: "view" } },
  { href: "/franchisee/leads", label: "Leads", icon: Funnel, permission: { resource: "leads", action: "view" } },
  { href: "/franchisee/bookings", label: "Booking Requests", icon: Calendar, permission: { resource: "bookings", action: "view" } },
  { href: "/franchisee/staff", label: "My Staff", icon: UserCog, permission: { resource: "staff", action: "view" } },
  { href: "/franchisee/notifications", label: "Notifications", icon: Bell, permission: { resource: "notifications", action: "view" } },
];

function FranchiseeSidebar({ onNavigate, embedded = false, className }: SidebarRenderProps & { className?: string }) {
  const [location] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const branding = useBranding();

  const navItems = ALL_NAV.filter(item =>
    !item.permission || hasPermission(item.permission.resource, item.permission.action),
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-secondary border-r border-white/5 w-60",
        embedded && "w-full border-r-0",
        className,
      )}
      data-testid="franchisee-sidebar"
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <BrandLogo variant="navbar" lazy={false} />
        <div className="min-w-0">
          <p className="text-white font-display font-bold text-sm leading-tight">Franchisee Portal</p>
          <p className="text-white/40 text-xs truncate">{user?.name ?? branding.brandName}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                active ? "bg-amber-500 text-white font-semibold" : "text-white/60 hover:text-white hover:bg-white/5",
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {user && (
          <div className="px-2 py-1 mb-2">
            <p className="text-white text-xs font-medium truncate">{user.name}</p>
            <p className="text-amber-400 text-xs">City Franchisee</p>
          </div>
        )}
        <button
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export default function FranchiseeLayout({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const branding = useBrandingPortal("franchisee");

  return (
    <PanelShell
      testId="franchisee-layout"
      mobileTitle="Franchisee Portal"
      sidebar={(props) => <FranchiseeSidebar {...props} />}
    >
      {isMobile && (
        <PwaInstallBanner
          portalKey="franchisee"
          title={`Install ${branding.brandName} Franchise`}
          description="Add the partner portal to your home screen for quick mobile access."
        />
      )}
      {children}
    </PanelShell>
  );
}
