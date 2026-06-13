import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SidebarRenderProps } from "./PanelShell";
import {
  LayoutDashboard, Users, UserCog, Calendar, CreditCard, FileText,
  AlertCircle, GitBranch, BarChart3, Bell, LogOut, ChevronRight,
  Menu, Building2, ShieldCheck, Key, UserX, Funnel, IndianRupee, Sparkles,
  Monitor, Crown, Radio, Palette, Activity, Scale, Search, Info, Database, BellRing,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { useBranding } from "@/lib/branding";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Permission gate. `null` = always show (e.g. dashboard). */
  perm: { resource: string; action: string } | null;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
      { href: "/admin/leads", label: "Leads & CRM", icon: Funnel, perm: { resource: "leads", action: "view" } },
      { href: "/admin/customers", label: "Customers", icon: Users, perm: { resource: "customers", action: "view" } },
      { href: "/admin/staff", label: "Staff", icon: UserCog, perm: { resource: "staff", action: "view" } },
      { href: "/admin/bookings", label: "Bookings", icon: Calendar, perm: { resource: "bookings", action: "view" } },
      { href: "/admin/daily-cleaning", label: "Daily Cleaning", icon: Sparkles, perm: { resource: "daily_cleaning", action: "view" } },
      { href: "/admin/daily-ops", label: "Daily Ops (Legacy)", icon: Sparkles, perm: { resource: "subscriptions", action: "view" } },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, perm: { resource: "subscriptions", action: "view" } },
      { href: "/admin/invoices", label: "Invoices & Payments", icon: FileText, perm: { resource: "invoices", action: "view" } },
      { href: "/admin/quotations", label: "Quotations", icon: FileText, perm: { resource: "invoices", action: "view" } },
      { href: "/admin/expenses", label: "Expenses", icon: IndianRupee, perm: { resource: "invoices", action: "view" } },
      { href: "/admin/dues", label: "Dues & Collections", icon: AlertCircle, perm: { resource: "invoices", action: "view" } },
      { href: "/admin/complaints", label: "Complaints", icon: AlertCircle, perm: { resource: "complaints", action: "view" } },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/admin/franchisees", label: "Franchisees", icon: Building2, perm: { resource: "franchisees", action: "view" } },
      { href: "/admin/staff-approval", label: "Staff Verification", icon: ShieldCheck, perm: { resource: "staff", action: "approve" } },
      { href: "/admin/credentials", label: "Credentials", icon: Key, perm: { resource: "staff", action: "approve" } },
      { href: "/admin/churned", label: "Churned Customers", icon: UserX, perm: { resource: "churned", action: "view" } },
    ],
  },
  {
    label: "Config",
    items: [
      { href: "/admin/branches", label: "Branches", icon: GitBranch, perm: { resource: "branches", action: "view" } },
      { href: "/admin/masters", label: "Master Data", icon: Database, perm: { resource: "masters", action: "view" } },
      { href: "/admin/catalog", label: "Service Catalog", icon: Sparkles, perm: { resource: "services", action: "view" } },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, perm: { resource: "analytics", action: "view" } },
      { href: "/admin/communications", label: "Communication Center", icon: Radio, perm: { resource: "communications", action: "view" } },
      { href: "/admin/notifications", label: "Notifications", icon: Bell, perm: { resource: "notifications", action: "view" } },
      { href: "/admin/push-logs", label: "Push Delivery Log", icon: BellRing, perm: { resource: "notifications", action: "view" } },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings/brand", label: "Brand Identity", icon: Palette, perm: { resource: "settings", action: "view" } },
      { href: "/admin/settings/business", label: "Business Info", icon: Info, perm: { resource: "settings", action: "view" } },
      { href: "/admin/settings/seo", label: "SEO Management", icon: Search, perm: { resource: "settings", action: "view" } },
      { href: "/admin/settings/system", label: "System Status", icon: Activity, perm: { resource: "settings", action: "view" } },
    ],
  },
  {
    label: "Legal & Compliance",
    items: [
      { href: "/admin/legal", label: "Legal Pages CMS", icon: Scale, perm: { resource: "settings", action: "view" } },
      { href: "/admin/compliance", label: "Compliance Settings", icon: ShieldCheck, perm: { resource: "settings", action: "view" } },
    ],
  },
  {
    label: "Views",
    items: [
      { href: "/admin/operations-wall", label: "Operations Wall", icon: Monitor, perm: null },
      { href: "/admin/founder", label: "Founder Dashboard", icon: Crown, perm: null },
    ],
  },
];

export default function AdminSidebar({ onNavigate, embedded = false, className }: SidebarRenderProps & { className?: string }) {
  const [location, setLocation] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const branding = useBranding();
  const collapsed = useAppStore(s => s.sidebarCollapsed);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const showCollapsed = collapsed && !embedded;

  // Filter nav by permission. Super-admin sees all; others see only what they can view.
  const visibleGroups = navGroups
    .map(g => ({
      ...g,
      items: g.items.filter(i => !i.perm || hasPermission(i.perm.resource, i.perm.action)),
    }))
    .filter(g => g.items.length > 0);

  return (
    <aside
      data-testid="admin-sidebar"
      className={cn(
        "flex flex-col h-full bg-secondary transition-all duration-300 border-r border-white/5 overflow-y-auto",
        embedded ? "w-full border-r-0" : showCollapsed ? "w-16" : "w-60",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <BrandLogo variant="navbar" imgClassName="h-8 w-8" fallbackClassName="w-8 h-8" lazy={false} />
        {!showCollapsed && (
          <div className="min-w-0">
            <p className="text-white font-display font-bold text-sm leading-tight">{branding.brandName} Admin</p>
            <p className="text-white/40 text-xs truncate">{branding.tagline ?? "Operations Hub"}</p>
            <SyncStatusIndicator className="mt-1.5 text-white/50" />
          </div>
        )}
        {!embedded && (
          <button
            onClick={toggleSidebar}
            className="ml-auto text-white/40 hover:text-white transition-colors"
            data-testid="sidebar-collapse-toggle"
            aria-label={showCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {showCollapsed ? <ChevronRight size={14} /> : <Menu size={14} />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {visibleGroups.map(group => (
          <div key={group.label}>
            {/* QW-10: Group labels with left accent line for visual hierarchy */}
            {!showCollapsed && (
              <div className="flex items-center gap-2 px-3 mb-1.5">
                <div className="w-0.5 h-3 rounded-full bg-primary/40 shrink-0" />
                <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">{group.label}</p>
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = location === href || location.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group",
                      active
                        ? "bg-primary text-secondary font-semibold"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    {!showCollapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
