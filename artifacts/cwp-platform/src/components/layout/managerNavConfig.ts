import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Calendar,
  AlertCircle,
  Sparkles,
  Star,
  CreditCard,
  Receipt,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  Contact,
  Building2,
} from "lucide-react";

export type ManagerNavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type ManagerNavSection = {
  label: string;
  entries: ManagerNavItem[];
};

export const MANAGER_NAV_SECTIONS: ManagerNavSection[] = [
  {
    label: "Overview",
    entries: [
      { id: "dashboard", href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "reports", href: "/manager/reports", label: "Branch Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Daily Operations",
    entries: [
      { id: "daily-cleaning", href: "/manager/daily-cleaning", label: "Daily Cleaning (DCMS)", icon: Sparkles },
      { id: "subscriptions", href: "/manager/daily-cleaning/subscriptions", label: "Subscriptions", icon: CreditCard },
      { id: "assignments", href: "/manager/daily-cleaning/assignments", label: "Staff Assignments", icon: CalendarCheck },
      { id: "history", href: "/manager/daily-cleaning/history", label: "Wash History", icon: ClipboardCheck },
      { id: "bookings", href: "/manager/bookings", label: "Bookings & Services", icon: Calendar },
    ],
  },
  {
    label: "Field Team & Customers",
    entries: [
      { id: "customers", href: "/manager/customers", label: "Customers", icon: Users },
      { id: "staff", href: "/manager/staff", label: "Staff & Attendance", icon: UserCog },
      { id: "quality", href: "/manager/quality", label: "Quality & Complaints", icon: Star },
    ],
  },
  {
    label: "Finance & Profile",
    entries: [
      { id: "collections", href: "/manager/collections", label: "Permitted Collections", icon: Receipt },
      { id: "profile", href: "/manager/profile", label: "My Profile", icon: Contact },
    ],
  },
];
