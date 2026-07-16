import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { useBrandingPortal } from "@/lib/branding";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
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

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const branding = useBrandingPortal("customer");

  const pageTitle = resolvePageTitle(location, branding.brandName);

  return (
    <AppShell
      testId="customer-layout"
      maxWidth="sm"
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
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground opacity-50 cursor-default"
              disabled
              aria-label="Notifications (coming soon)"
              data-testid="notifications-placeholder"
            >
              <Bell size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </Button>
          </>
        ),
      }}
      bottomNav={navItems}
    >
      {children}
    </AppShell>
  );
}
