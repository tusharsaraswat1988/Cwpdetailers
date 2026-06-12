import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { SidebarRenderProps } from "./PanelShell";
import { LayoutDashboard, Calendar, CheckSquare, Clock, Award, LogOut, Sun } from "lucide-react";
import PanelShell from "./PanelShell";

const navItems = [
  { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/schedule", label: "Schedule", icon: Calendar },
  { href: "/staff/attendance", label: "Attendance", icon: Clock },
  { href: "/staff/performance", label: "Performance", icon: Award },
];

function StaffSidebar({ onNavigate, embedded = false, className }: SidebarRenderProps & { className?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-secondary border-r border-white/5 w-60",
        embedded && "w-full border-r-0",
        className,
      )}
      data-testid="staff-sidebar"
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Sun size={16} className="text-secondary" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-display font-bold text-sm">CWP Staff</p>
          <p className="text-white/40 text-xs truncate">Field Portal</p>
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
                active ? "bg-primary text-secondary font-semibold" : "text-white/60 hover:text-white hover:bg-white/5",
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
            <p className="text-white/40 text-xs">Field Technician</p>
          </div>
        )}
        <button
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <PanelShell
      testId="staff-layout"
      mobileTitle="CWP Staff"
      sidebar={(props) => <StaffSidebar {...props} />}
    >
      {children}
    </PanelShell>
  );
}
