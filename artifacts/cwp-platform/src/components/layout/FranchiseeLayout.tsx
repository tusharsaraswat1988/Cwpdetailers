import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, UserCog, LogOut, Sun,
  ChevronRight, Menu, UserX, Bell, Funnel,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** permission needed to see this item; omit to always show */
  permission?: { resource: string; action: string };
};

const ALL_NAV: NavItem[] = [
  { href: "/franchisee/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/franchisee/leads", label: "Leads", icon: Funnel, permission: { resource: "leads", action: "view" } },
  { href: "/franchisee/bookings", label: "Booking Requests", icon: Calendar, permission: { resource: "bookings", action: "view" } },
  { href: "/franchisee/staff", label: "My Staff", icon: UserCog, permission: { resource: "staff", action: "view" } },
  { href: "/franchisee/churned", label: "Churned Customers", icon: UserX, permission: { resource: "churned", action: "view" } },
  { href: "/franchisee/notifications", label: "Notifications", icon: Bell, permission: { resource: "notifications", action: "view" } },
];

export default function FranchiseeLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = ALL_NAV.filter(item =>
    !item.permission || hasPermission(item.permission.resource, item.permission.action),
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden" data-testid="franchisee-layout">
      <aside className={cn(
        "flex flex-col h-screen bg-secondary sticky top-0 transition-all duration-300 border-r border-white/5",
        collapsed ? "w-16" : "w-60",
      )}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <Sun size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-display font-bold text-sm leading-tight">Franchisee Portal</p>
              <p className="text-white/40 text-xs truncate">{user?.name ?? "City Partner"}</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-white/40 hover:text-white transition-colors">
            {collapsed ? <ChevronRight size={14} /> : <Menu size={14} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active ? "bg-amber-500 text-white font-semibold" : "text-white/60 hover:text-white hover:bg-white/5",
                )}>
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          {!collapsed && user && (
            <div className="px-2 py-1 mb-2">
              <p className="text-white text-xs font-medium truncate">{user.name}</p>
              <p className="text-amber-400 text-xs">City Franchisee</p>
            </div>
          )}
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm">
            <LogOut size={14} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
