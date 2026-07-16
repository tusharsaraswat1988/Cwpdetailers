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
  Archive,
  Home,
  Percent,
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

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Dashboard",
    entries: [
      { id: "dashboard", href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
    ],
  },
  {
    label: "Customers",
    entries: [
      {
        id: "customer-profile",
        href: "/admin/customers",
        label: "Customer Profile",
        icon: Users,
        perm: { resource: "customers", action: "view" },
      },
    ],
  },
  {
    label: "Operations",
    entries: [
      {
        id: "book-services",
        href: "/admin/book-services",
        label: "Create Service Request",
        icon: CalendarCheck,
        perm: { resource: "bookings", action: "view" },
      },
      {
        id: "bookings",
        href: "/admin/bookings",
        label: "Bookings",
        icon: Calendar,
        perm: { resource: "bookings", action: "view" },
      },
      {
        id: "assign-services",
        href: "/admin/assign-services",
        label: "Assign Service",
        icon: ClipboardCheck,
        perm: { resource: "bookings", action: "edit" },
      },
      {
        id: "daily-clean-reports",
        href: "/admin/daily-cleaning",
        label: "Daily Clean Reports",
        icon: Sparkles,
        perm: { resource: "daily_cleaning", action: "view" },
      },
      {
        id: "service-updates",
        href: "/admin/service-updates",
        label: "Service Updates",
        icon: Monitor,
        perm: null,
      },
      { id: "leads", href: "/admin/leads", label: "Leads & CRM", icon: Funnel, perm: { resource: "leads", action: "view" } },
    ],
  },
  {
    label: "Master Setup",
    entries: [
      {
        id: "services",
        href: "/admin/services",
        label: "Service Catalog",
        icon: Package,
        perm: { resource: "services", action: "view" },
      },
      { id: "staff", href: "/admin/staff", label: "Staff", icon: UserCog, perm: { resource: "staff", action: "view" } },
    ],
  },
  {
    label: "Marketing",
    defaultCollapsed: true,
    variant: "admin",
    entries: [
      {
        id: "homepage-cms",
        href: "/admin/services?tab=homepage",
        label: "Homepage CMS",
        icon: Home,
        perm: { resource: "services", action: "view" },
      },
    ],
  },
  {
    label: "Finance",
    entries: [
      {
        id: "billing",
        href: "/admin/billing",
        label: "Billing & Finance",
        icon: FileText,
        perm: { resource: "invoices", action: "view" },
      },
    ],
  },
  {
    label: "Support",
    entries: [
      { id: "complaints", href: "/admin/complaints", label: "Complaints", icon: AlertCircle, perm: { resource: "complaints", action: "view" } },
    ],
  },
  {
    label: "Migration Tools",
    defaultCollapsed: true,
    variant: "admin",
    entries: [
      {
        id: MIGRATION_GROUP_ID,
        label: "Migration Tools",
        icon: Upload,
        perm: { resource: "customers", action: "create" },
        description: "One-time imports and legacy contact lists — not daily operations.",
        children: [
          {
            id: "import",
            href: "/admin/customers/migration",
            label: "Import Existing Customers",
            icon: Upload,
            perm: { resource: "customers", action: "create" },
          },
          {
            id: "legacy_contacts",
            href: "/admin/customers/legacy-contacts",
            label: "Legacy Contacts",
            icon: Contact,
            perm: { resource: "customers", action: "view" },
          },
        ],
      },
    ],
  },
  {
    label: "Admin",
    defaultCollapsed: true,
    variant: "admin",
    entries: [
      { id: "franchisees", href: "/admin/franchisees", label: "Franchisees", icon: Building2, perm: { resource: "franchisees", action: "view" } },
      { id: "staff-approval", href: "/admin/staff-approval", label: "Verify Staff", icon: ShieldCheck, perm: { resource: "staff", action: "approve" } },
      { id: "credentials", href: "/admin/credentials", label: "Credentials", icon: Key, perm: { resource: "staff", action: "approve" } },
      { id: "branches", href: "/admin/branches", label: "Branches", icon: GitBranch, perm: { resource: "branches", action: "view" } },
      { id: "masters", href: "/admin/masters", label: "Master Data", icon: Database, perm: { resource: "masters", action: "view" } },
      { id: "analytics", href: "/admin/analytics", label: "Analytics", icon: BarChart3, perm: { resource: "analytics", action: "view" } },
      { id: "communications", href: "/admin/communications", label: "Communication Center", icon: Radio, perm: { resource: "communications", action: "view" } },
      { id: "notifications", href: "/admin/notifications", label: "Notifications", icon: Bell, perm: { resource: "notifications", action: "view" } },
      { id: "push-logs", href: "/admin/push-logs", label: "Push Delivery Log", icon: BellRing, perm: { resource: "notifications", action: "view" } },
      { id: "brand", href: "/admin/settings/brand", label: "Branding", icon: Palette, perm: { resource: "settings", action: "view" } },
      { id: "invoice_billing", href: "/admin/settings/invoice-billing", label: "Invoice & GST", icon: Receipt, perm: { resource: "invoices", action: "view" } },
      {
        id: "catalog-gst",
        href: "/admin/services?tab=advanced",
        label: "Catalog GST Defaults",
        icon: Percent,
        perm: { resource: "services", action: "view" },
      },
      { id: "business", href: "/admin/settings/business", label: "Business Info", icon: Info, perm: { resource: "settings", action: "view" } },
      { id: "seo", href: "/admin/settings/seo", label: "SEO Management", icon: Search, perm: { resource: "settings", action: "view" } },
      { id: "system", href: "/admin/settings/system", label: "System Status", icon: Activity, perm: { resource: "settings", action: "view" } },
      { id: "legal", href: "/admin/legal", label: "Legal Pages CMS", icon: Scale, perm: { resource: "settings", action: "view" } },
      { id: "compliance", href: "/admin/compliance", label: "Compliance Settings", icon: ShieldCheck, perm: { resource: "settings", action: "view" } },
      { id: "founder", href: "/admin/founder", label: "Founder Dashboard", icon: Crown, perm: null },
    ],
  },
];

export function isAdminNavItemActive(location: string, item: AdminNavItem): boolean {
  if (item.id === "directory" || item.id === "customer-profile") {
    if (location === "/admin/customers") return true;
    if (/^\/admin\/customers\/\d+/.test(location)) return true;
    return false;
  }
  if (item.id === "book-services") {
    const path = location.split("?")[0]!;
    return path === "/admin/book-services";
  }
  if (item.id === "bookings") {
    const path = location.split("?")[0]!;
    return path === "/admin/bookings";
  }
  if (item.id === "daily-clean-reports") {
    const path = location.split("?")[0]!;
    return path.startsWith("/admin/daily-cleaning");
  }
  if (item.id === "assign-services") {
    const path = location.split("?")[0]!;
    return path === "/admin/assign-services";
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
  if (item.id === "import") {
    return location.startsWith("/admin/customers/migration");
  }
  if (item.id === "reactivated") {
    return location.startsWith("/admin/customers/reactivated");
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
