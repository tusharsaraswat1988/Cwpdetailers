import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Calendar,
  FileText,
  AlertCircle,
  GitBranch,
  BarChart3,
  Bell,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Key,
  Funnel,
  Sparkles,
  Monitor,
  Crown,
  Radio,
  Palette,
  Activity,
  Scale,
  Search,
  Info,
  Database,
  BellRing,
  Upload,
  Contact,
  Package,
  MapPin,
  Receipt,
  CalendarCheck,
  ClipboardCheck,
  ListTodo,
  Archive,
  Home,
  Percent,
  Wrench,
  CreditCard,
  Star,
  Megaphone,
  Gift,
} from "lucide-react";

export type AdminNavPermission = { resource: string; action: string };

export type AdminNavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  perm: AdminNavPermission | null;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  perm: AdminNavPermission | null;
  children: AdminNavItem[];
  /** Shown when expanded — e.g. legacy warning */
  description?: string;
};

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

export const CUSTOMER_HUB_GROUP_ID = "customer-hub";
export const LEGACY_GROUP_ID = "legacy-module";
export const MIGRATION_GROUP_ID = "migration-tools";

export function isAdminNavGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return "children" in entry;
}

/** In-page hub tabs on customer-related screens (not sidebar). */
export const CUSTOMER_HUB_CHILDREN: AdminNavItem[] = [
  {
    id: "directory",
    href: "/admin/customers",
    label: "Customer Profile",
    icon: Users,
    perm: { resource: "customers", action: "view" },
  },
  {
    id: "bookings",
    href: "/admin/bookings",
    label: "Bookings",
    icon: Calendar,
    perm: { resource: "bookings", action: "view" },
  },
];

export type AdminNavSection = {
  label: string;
  entries: AdminNavEntry[];
  /** Sidebar section starts collapsed (Legacy, Admin). */
  defaultCollapsed?: boolean;
  variant?: "default" | "legacy" | "admin";
};

/**
 * Six functional groups (Operations, Commercial, Customers, People, Reports,
 * Configuration) plus a standalone Dashboard entry — every existing id/href/
 * permission is unchanged from the previous "Master Setup/Marketing/Finance/
 * Support/Admin" grouping; only the section labels and grouping changed, per
 * docs/PHASE_6_ADMIN_UX_CONSOLIDATION.md Sprint 1 navigation step.
 */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Overview",
    entries: [
      { id: "dashboard", href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
      { id: "analytics", href: "/admin/analytics", label: "Analytics & Reports", icon: BarChart3, perm: { resource: "analytics", action: "view" } },
    ],
  },
  {
    label: "Daily Operations",
    entries: [
      {
        id: "daily-cleaning",
        href: "/admin/daily-cleaning",
        label: "Daily Cleaning (DCMS)",
        icon: Sparkles,
        perm: { resource: "daily_cleaning", action: "view" },
      },
      {
        id: "subscriptions",
        href: "/admin/subscriptions",
        label: "Subscriptions",
        icon: CreditCard,
        perm: { resource: "subscriptions", action: "view" },
      },
      {
        id: "bookings",
        href: "/admin/bookings",
        label: "Service Bookings",
        icon: Calendar,
        perm: { resource: "bookings", action: "view" },
      },
      {
        id: "makeup-approvals",
        href: "/admin/approvals",
        label: "Makeup Approvals",
        icon: ClipboardCheck,
        perm: { resource: "bookings", action: "edit" },
      },
      {
        id: "jobs",
        href: "/admin/jobs",
        label: "Job Board",
        icon: ListTodo,
        perm: { resource: "bookings", action: "edit" },
      },
      {
        id: "exceptions-hub",
        href: "/admin/exceptions",
        label: "Service Exceptions",
        icon: ShieldAlert,
        perm: { resource: "bookings", action: "view" },
      },
      {
        id: "complaints",
        href: "/admin/complaints",
        label: "Complaints & Support",
        icon: AlertCircle,
        perm: { resource: "complaints", action: "view" },
      },
      {
        id: "quality-hub",
        href: "/admin/quality",
        label: "Service Quality & SLA",
        icon: Star,
        perm: { resource: "analytics", action: "view" },
      },
    ],
  },
  {
    label: "Customers & CRM",
    defaultCollapsed: true,
    entries: [
      {
        id: "customers",
        href: "/admin/customers",
        label: "Customer Directory",
        icon: Users,
        perm: { resource: "customers", action: "view" },
      },
      {
        id: "loyalty-rewards",
        href: "/admin/loyalty",
        label: "Loyalty & Referrals",
        icon: Gift,
        perm: { resource: "customers", action: "view" },
      },
      {
        id: "leads",
        href: "/admin/leads",
        label: "Leads & CRM",
        icon: Funnel,
        perm: { resource: "leads", action: "view" },
      },
      {
        id: "assets",
        href: "/admin/assets",
        label: "Customer Vehicles",
        icon: Wrench,
        perm: { resource: "customers", action: "view" },
      },
      {
        id: "migration",
        href: "/admin/customers/migration",
        label: "Data Migration",
        icon: Upload,
        perm: { resource: "customers", action: "create" },
      },
    ],
  },
  {
    label: "Commercial & Billing",
    defaultCollapsed: true,
    entries: [
      {
        id: "billing",
        href: "/admin/billing",
        label: "Billing & Invoices",
        icon: FileText,
        perm: { resource: "invoices", action: "view" },
      },
      {
        id: "payment-ledger",
        href: "/admin/payments/ledger",
        label: "Payment Ledger",
        icon: Receipt,
        perm: { resource: "invoices", action: "view" },
      },
      {
        id: "services",
        href: "/admin/services",
        label: "Service Catalog",
        icon: Package,
        perm: { resource: "services", action: "view" },
      },
    ],
  },
  {
    label: "Staff & Team",
    defaultCollapsed: true,
    entries: [
      {
        id: "staff",
        href: "/admin/staff",
        label: "Staff & Cleaners",
        icon: UserCog,
        perm: { resource: "staff", action: "view" },
      },
      {
        id: "staff-approval",
        href: "/admin/staff-approval",
        label: "Verify Staff",
        icon: ShieldCheck,
        perm: { resource: "staff", action: "approve" },
      },
    ],
  },
  {
    label: "Network & Coverage",
    defaultCollapsed: true,
    variant: "admin",
    entries: [
      {
        id: "cities",
        href: "/admin/cities",
        label: "Cities & Expansion",
        icon: MapPin,
        perm: { resource: "branches", action: "view" },
      },
      {
        id: "branches",
        href: "/admin/branches",
        label: "Branches",
        icon: GitBranch,
        perm: { resource: "branches", action: "view" },
      },
      {
        id: "societies",
        href: "/admin/societies",
        label: "Societies & Towers",
        icon: Building2,
        perm: { resource: "branches", action: "view" },
      },
      {
        id: "franchisees",
        href: "/admin/franchisees",
        label: "Franchisees",
        icon: Building2,
        perm: { resource: "franchisees", action: "view" },
      },
      {
        id: "masters",
        href: "/admin/masters",
        label: "Master Data",
        icon: Database,
        perm: { resource: "masters", action: "view" },
      },
      {
        id: "communications",
        href: "/admin/communications",
        label: "Communications",
        icon: Radio,
        perm: { resource: "communications", action: "view" },
      },
      {
        id: "marketing-cms",
        href: "/admin/marketing",
        label: "Marketing & CMS",
        icon: Megaphone,
        perm: { resource: "settings", action: "view" },
      },
      {
        id: "automation-center",
        href: "/admin/automation",
        label: "Automation & Jobs",
        icon: Activity,
        perm: { resource: "settings", action: "view" },
      },
      {
        id: "settings",
        href: "/admin/settings/brand",
        label: "Platform Settings",
        icon: Palette,
        perm: { resource: "settings", action: "view" },
      },
    ],
  },
];

export function isAdminNavItemActive(location: string, item: AdminNavItem): boolean {
  if (item.id === "directory" || item.id === "customer-profile" || item.id === "customers") {
    if (location === "/admin/customers") return true;
    if (/^\/admin\/customers\/\d+/.test(location)) return true;
    return false;
  }
  if (item.id === "subscriptions") {
    const path = location.split("?")[0]!;
    return path.startsWith("/admin/subscriptions") || path.startsWith("/admin/daily-cleaning/subscriptions");
  }
  if (item.id === "book-services") {
    const path = location.split("?")[0]!;
    return path === "/admin/book-services";
  }
  if (item.id === "bookings") {
    const path = location.split("?")[0]!;
    return path === "/admin/bookings";
  }
  if (item.id === "daily-cleaning" || item.id === "daily-clean-reports") {
    const path = location.split("?")[0]!;
    return path.startsWith("/admin/daily-cleaning") && !path.includes("/subscriptions");
  }
  if (item.id === "assign-services") {
    const path = location.split("?")[0]!;
    return path === "/admin/assign-services";
  }
  if (item.id === "jobs" || item.id === "job-orchestration") {
    const path = location.split("?")[0]!;
    return path === "/admin/jobs";
  }
  if (item.id === "assets") {
    const path = location.split("?")[0]!;
    return path === "/admin/assets" || /^\/admin\/assets\/\d+/.test(path);
  }
  if (item.id === "service-locations") {
    const path = location.split("?")[0]!;
    return path === "/admin/service-locations" || /^\/admin\/service-locations\/\d+/.test(path);
  }
  if (item.id === "homepage-cms") {
    return location.includes("tab=homepage");
  }
  if (item.id === "catalog-gst") {
    return location.includes("tab=advanced") || location.includes("tab=settings");
  }
  if (item.id === "services") {
    if (
      location.includes("tab=homepage")
      || location.includes("tab=advanced")
      || location.includes("tab=settings")
    ) {
      return false;
    }
    const path = location.split("?")[0]!;
    return path === "/admin/services" || path === "/admin/products" || path === "/admin/catalog";
  }
  if (item.id === "billing") {
    const path = location.split("?")[0]!;
    return path === "/admin/billing" || path === "/admin/invoices" || path === "/admin/dues";
  }
  if (item.id === "service-updates") {
    const path = location.split("?")[0]!;
    return path === "/admin/service-updates" || path === "/admin/operations-wall";
  }
  if (item.id === "legacy_contacts") {
    return location.startsWith("/admin/customers/legacy-contacts");
  }
  if (item.id === "daily-clean-reports") {
    return location.startsWith("/admin/daily-cleaning");
  }
  if (item.id === "import" || item.id === "migration") {
    return location.startsWith("/admin/customers/migration");
  }
  if (item.id === "reactivated") {
    return location.startsWith("/admin/customers/reactivated");
  }
  if (item.id === "settings") {
    return location.startsWith("/admin/settings");
  }
  if (item.href.includes("?")) {
    const [path, query] = item.href.split("?");
    return location.startsWith(path!) && location.includes(query!);
  }
  return location === item.href || location.startsWith(`${item.href}/`);
}

export function isAdminNavGroupActive(location: string, group: AdminNavGroup): boolean {
  return group.children.some(child => isAdminNavItemActive(location, child));
}

export function isAdminNavSectionActive(location: string, section: AdminNavSection): boolean {
  return section.entries.some(entry =>
    isAdminNavGroup(entry) ? isAdminNavGroupActive(location, entry) : isAdminNavItemActive(location, entry),
  );
}

export function filterAdminNavSections(
  sections: AdminNavSection[],
  hasPermission: (resource: string, action: string) => boolean,
): AdminNavSection[] {
  return sections
    .map(section => ({
      ...section,
      entries: section.entries
        .map(entry => {
          if (!isAdminNavGroup(entry)) {
            if (entry.perm && !hasPermission(entry.perm.resource, entry.perm.action)) return null;
            return entry;
          }
          const children = entry.children.filter(
            c => !c.perm || hasPermission(c.perm.resource, c.perm.action),
          );
          if (children.length === 0) return null;
          return { ...entry, children };
        })
        .filter(Boolean) as AdminNavEntry[],
    }))
    .filter(section => section.entries.length > 0);
}
