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
  UserCheck,
  UserX,
  ClipboardList,
  Package,
  Layers,
  MapPin,
  Receipt,
  CalendarCheck,
  ClipboardCheck,
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
};

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

export const CUSTOMER_HUB_GROUP_ID = "customer-hub";

export function isAdminNavGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return "children" in entry;
}

/** Customer-facing operations only — catalog/plan setup lives under Services. */
export const CUSTOMER_HUB_CHILDREN: AdminNavItem[] = [
  {
    id: "directory",
    href: "/admin/customers",
    label: "Customer 360",
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
  {
    id: "legacy_contacts",
    href: "/admin/customers/legacy-contacts",
    label: "Legacy Contacts",
    icon: Contact,
    perm: { resource: "customers", action: "view" },
  },
  {
    id: "reactivated",
    href: "/admin/customers/reactivated",
    label: "Reactivated",
    icon: UserCheck,
    perm: { resource: "customers", action: "view" },
  },
  {
    id: "import",
    href: "/admin/customers/migration",
    label: "Import",
    icon: Upload,
    perm: { resource: "customers", action: "create" },
  },
  {
    id: "churned",
    href: "/admin/churned",
    label: "Churned",
    icon: UserX,
    perm: { resource: "churned", action: "view" },
  },
];

export type AdminNavSection = {
  label: string;
  entries: AdminNavEntry[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Operations",
    entries: [
      { id: "dashboard", href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null },
      { id: "leads", href: "/admin/leads", label: "Leads & CRM", icon: Funnel, perm: { resource: "leads", action: "view" } },
      {
        id: CUSTOMER_HUB_GROUP_ID,
        label: "Customers",
        icon: ClipboardList,
        perm: null,
        children: CUSTOMER_HUB_CHILDREN,
      },
      {
        id: "service-locations",
        href: "/admin/service-locations",
        label: "Service Locations",
        icon: MapPin,
        perm: { resource: "customers", action: "view" },
      },
      {
        id: "assets",
        href: "/admin/assets",
        label: "Assets",
        icon: Layers,
        perm: { resource: "customers", action: "view" },
      },
      {
        id: "book-services",
        href: "/admin/book-services",
        label: "Book Services",
        icon: CalendarCheck,
        perm: { resource: "bookings", action: "view" },
      },
      {
        id: "assign-services",
        href: "/admin/assign-services",
        label: "Assign Services",
        icon: ClipboardCheck,
        perm: { resource: "bookings", action: "edit" },
      },
      {
        id: "services",
        href: "/admin/services",
        label: "Services",
        icon: Package,
        perm: { resource: "services", action: "view" },
      },
      {
        id: "dcms_ops",
        href: "/admin/daily-cleaning",
        label: "DCMS Operations",
        icon: Sparkles,
        perm: { resource: "daily_cleaning", action: "view" },
      },
      { id: "staff", href: "/admin/staff", label: "Staff", icon: UserCog, perm: { resource: "staff", action: "view" } },
      {
        id: "billing",
        href: "/admin/billing",
        label: "Billing & Finance",
        icon: FileText,
        perm: { resource: "invoices", action: "view" },
      },
      { id: "dues", href: "/admin/dues", label: "Dues & Collections", icon: AlertCircle, perm: { resource: "invoices", action: "view" } },
      { id: "complaints", href: "/admin/complaints", label: "Complaints", icon: AlertCircle, perm: { resource: "complaints", action: "view" } },
      {
        id: "service-updates",
        href: "/admin/service-updates",
        label: "Service Updates",
        icon: Monitor,
        perm: null,
      },
    ],
  },
  {
    label: "Network",
    entries: [
      { id: "franchisees", href: "/admin/franchisees", label: "Franchisees", icon: Building2, perm: { resource: "franchisees", action: "view" } },
      { id: "staff-approval", href: "/admin/staff-approval", label: "Staff Verification", icon: ShieldCheck, perm: { resource: "staff", action: "approve" } },
      { id: "credentials", href: "/admin/credentials", label: "Credentials", icon: Key, perm: { resource: "staff", action: "approve" } },
    ],
  },
  {
    label: "Config",
    entries: [
      { id: "branches", href: "/admin/branches", label: "Branches", icon: GitBranch, perm: { resource: "branches", action: "view" } },
      { id: "masters", href: "/admin/masters", label: "Master Data", icon: Database, perm: { resource: "masters", action: "view" } },
      { id: "analytics", href: "/admin/analytics", label: "Analytics", icon: BarChart3, perm: { resource: "analytics", action: "view" } },
      { id: "communications", href: "/admin/communications", label: "Communication Center", icon: Radio, perm: { resource: "communications", action: "view" } },
      { id: "notifications", href: "/admin/notifications", label: "Notifications", icon: Bell, perm: { resource: "notifications", action: "view" } },
      { id: "push-logs", href: "/admin/push-logs", label: "Push Delivery Log", icon: BellRing, perm: { resource: "notifications", action: "view" } },
    ],
  },
  {
    label: "Settings",
    entries: [
      { id: "brand", href: "/admin/settings/brand", label: "Brand Identity", icon: Palette, perm: { resource: "settings", action: "view" } },
      { id: "invoice_billing", href: "/admin/settings/invoice-billing", label: "Invoice & GST", icon: Receipt, perm: { resource: "invoices", action: "view" } },
      { id: "business", href: "/admin/settings/business", label: "Business Info", icon: Info, perm: { resource: "settings", action: "view" } },
      { id: "seo", href: "/admin/settings/seo", label: "SEO Management", icon: Search, perm: { resource: "settings", action: "view" } },
      { id: "system", href: "/admin/settings/system", label: "System Status", icon: Activity, perm: { resource: "settings", action: "view" } },
    ],
  },
  {
    label: "Legal & Compliance",
    entries: [
      { id: "legal", href: "/admin/legal", label: "Legal Pages CMS", icon: Scale, perm: { resource: "settings", action: "view" } },
      { id: "compliance", href: "/admin/compliance", label: "Compliance Settings", icon: ShieldCheck, perm: { resource: "settings", action: "view" } },
    ],
  },
  {
    label: "Views",
    entries: [
      { id: "founder", href: "/admin/founder", label: "Founder Dashboard", icon: Crown, perm: null },
    ],
  },
];

export function isAdminNavItemActive(location: string, item: AdminNavItem): boolean {
  if (item.id === "directory") {
    if (location === "/admin/customers") return true;
    return /^\/admin\/customers\/\d+/.test(location);
  }
  if (item.id === "book-services") {
    const path = location.split("?")[0]!;
    return path === "/admin/book-services";
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
  if (item.id === "services") {
    const path = location.split("?")[0]!;
    return path === "/admin/services" || path === "/admin/products" || path === "/admin/catalog";
  }
  if (item.id === "billing") {
    const path = location.split("?")[0]!;
    return path === "/admin/billing" || path === "/admin/invoices";
  }
  if (item.id === "service-updates") {
    const path = location.split("?")[0]!;
    return path === "/admin/service-updates" || path === "/admin/operations-wall";
  }
  if (item.id === "dcms_ops") {
    return location.startsWith("/admin/daily-cleaning");
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
