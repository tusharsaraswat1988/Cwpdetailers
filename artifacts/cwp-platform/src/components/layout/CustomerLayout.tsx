import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { useBrandingPortal } from "@/lib/branding";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { CustomerThemeRoot, CustomerButton } from "@/features/customer-ds";
import {
  LogOut, LayoutDashboard, Calendar, ClipboardList, User, Car, Bell,
} from "lucide-react";

/** Frozen IA v1.0 — Home · My Plans · Schedule (FAB) · Assets · Account */
const navItems: BottomNavItem[] = [
  { href: CUSTOMER_ROUTES.home, label: "Home", icon: LayoutDashboard },
  { href: CUSTOMER_ROUTES.plans, label: "My Plans", icon: ClipboardList },
  { href: CUSTOMER_ROUTES.scheduleEntry({ from: "fab" }), label: "Schedule", icon: Calendar, fab: true },
  { href: CUSTOMER_ROUTES.assets, label: "Assets", icon: Car },
  { href: CUSTOMER_ROUTES.account, label: "Account", icon: User },
];

const pageTitles: Record<string, string> = {
  [CUSTOMER_ROUTES.home]: "Home",
  [CUSTOMER_ROUTES.plans]: "My Plans",
  [CUSTOMER_ROUTES.schedule]: "Schedule",
  [CUSTOMER_ROUTES.assets]: "My Vehicles & Solar Sites",
  [CUSTOMER_ROUTES.account]: "Account",
  "/customer/wallet": "My Plans",
  "/customer/services": "My Plans",
  "/customer/bookings": "Schedule",
  "/customer/book": "Schedule",
  "/customer/daily-cleaning": "Daily Cleaning",
  "/customer/daily-cleaning/history": "Visit History",
  "/customer/daily-cleaning/gallery": "Photo Gallery",
  [CUSTOMER_ROUTES.serviceHistory]: "Service History",
  "/customer/plans/": "Plan Details",
  [CUSTOMER_ROUTES.invoices]: "Invoices",
  [CUSTOMER_ROUTES.support]: "Support",
  "/customer/complaints": "Support",
};

function resolvePageTitle(location: string, brandingName: string): string {
  if (pageTitles[location]) return pageTitles[location];

  if (location.startsWith("/customer/schedule/")) return "Scheduled Service";
  if (location.startsWith("/customer/bookings/")) return "Scheduled Service";
  if (location.startsWith("/customer/plans/")) return "Plan Details";

  const navMatch = navItems.find(
    item => location === item.href || location.startsWith(item.href + "/"),
  );
  return navMatch?.label ?? brandingName;
}

type CustomerLayoutProps = {
  children: ReactNode;
  /** Override shell width — Account hub uses `hub` for two-column desktop. */
  maxWidth?: "sm" | "md" | "hub" | "full";
};

export default function CustomerLayout({ children, maxWidth = "sm" }: CustomerLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const branding = useBrandingPortal("customer");

  const pageTitle = resolvePageTitle(location, branding.brandName);

  return (
    <CustomerThemeRoot>
      <AppShell
        testId="customer-layout"
        maxWidth={maxWidth}
        appBar={{
          leading: (
            <Link href={CUSTOMER_ROUTES.home} className="flex items-center gap-2 shrink-0">
              <BrandLogo variant="mobile" lazy={false} />
            </Link>
          ),
          title: pageTitle,
          subtitle: user?.name,
          trailing: (
            <>
              <SyncStatusIndicator compact className="hidden sm:inline-flex" />
              <CustomerButton
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground opacity-50 cursor-default"
                disabled
                aria-label="Notifications (coming soon)"
                data-testid="notifications-placeholder"
              >
                <Bell size={18} />
              </CustomerButton>
              <CustomerButton
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground hover:text-destructive"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </CustomerButton>
            </>
          ),
        }}
        bottomNav={navItems}
      >
        {children}
      </AppShell>
    </CustomerThemeRoot>
  );
}
