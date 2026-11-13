import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { useBrandingPortal } from "@/lib/branding";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { CustomerThemeRoot, CustomerButton } from "@/features/customer-ds";
import { CustomerExtraServiceApprovalHost } from "@/features/extra-service/components/CustomerExtraServiceApprovalHost";
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
  [CUSTOMER_ROUTES.loyalty]: "Rewards & Referrals",
  [CUSTOMER_ROUTES.rewards]: "Rewards & Referrals",
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
  if (location.startsWith("/customer/services/")) return "Service Details";

  const navMatch = navItems.find(
    item => location === item.href || location.startsWith(item.href + "/"),
  );
  return navMatch?.label ?? brandingName;
}

type CustomerLayoutProps = {
  children: ReactNode;
  /** Override shell width — Account hub uses `hub` for two-column desktop. */
  maxWidth?: "sm" | "md" | "hub" | "full" | "responsive";
};

export default function CustomerLayout({ children, maxWidth = "responsive" }: CustomerLayoutProps) {
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
            <div className="flex items-center gap-3 shrink-0">
              <Link href={CUSTOMER_ROUTES.home} className="flex items-center gap-2 shrink-0">
                <BrandLogo variant="mobile" lazy={false} />
              </Link>
              <nav className="hidden md:flex items-center gap-1 ml-2" aria-label="Desktop navigation">
                {navItems.map(item => {
                  const active = location === item.href || (item.href !== "/customer/dashboard" && location.startsWith(item.href + "/"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium",
                      )}
                    >
                      <item.icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ),
          title: pageTitle,
          subtitle: user?.name,
          trailing: (
            <div className="flex items-center gap-1.5">
              <SyncStatusIndicator compact className="hidden sm:inline-flex" />
              <Link
                href={CUSTOMER_ROUTES.account}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-blue-50/50 transition-all cursor-pointer shadow-2xs"
                title="My Account"
                aria-label="Go to My Account"
              >
                <User size={18} />
              </Link>
              <CustomerButton
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-destructive hidden sm:flex"
                onClick={() => logout()}
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </CustomerButton>
            </div>
          ),
        }}
        bottomNav={navItems}
      >
        {children}
        <CustomerExtraServiceApprovalHost />
      </AppShell>
    </CustomerThemeRoot>
  );
}
