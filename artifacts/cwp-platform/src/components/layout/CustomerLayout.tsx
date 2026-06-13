import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBrandingPortal } from "@/lib/branding";
import {
  LogOut, Bell, LayoutDashboard, Calendar, CreditCard, IndianRupee, User,
} from "lucide-react";

const navItems: BottomNavItem[] = [
  { href: "/customer/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/customer/services", label: "Services", icon: CreditCard },
  { href: "/customer/bookings", label: "Book", icon: Calendar, fab: true },
  { href: "/customer/wallet", label: "Wallet", icon: IndianRupee },
  { href: "/customer/account", label: "Account", icon: User },
];

const pageTitles: Record<string, string> = {
  "/customer/dashboard": "Home",
  "/customer/services": "Services",
  "/customer/bookings": "Book",
  "/customer/wallet": "Wallet",
  "/customer/account": "Account",
  "/customer/history": "History",
  "/customer/invoices": "Invoices",
  "/customer/assets": "My Assets",
  "/customer/complaints": "Support",
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const branding = useBrandingPortal("customer");

  const pageTitle =
    pageTitles[location] ??
    navItems.find(item => location === item.href || location.startsWith(item.href + "/"))?.label ??
    branding.brandName;

  return (
    <AppShell
      testId="customer-layout"
      maxWidth="sm"
      appBar={{
        leading: (
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <BrandLogo variant="mobile" imgClassName="h-8 w-8" fallbackClassName="w-8 h-8" lazy={false} />
          </Link>
        ),
        title: pageTitle,
        subtitle: user?.name,
        trailing: (
          <>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Notifications">
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
      <PwaInstallBanner
        portalKey="customer"
        title={`Install ${branding.brandName} app`}
        description={`Add ${branding.brandName} to your home screen for quick access to bookings, wallet, and services.`}
      />
      {children}
    </AppShell>
  );
}
