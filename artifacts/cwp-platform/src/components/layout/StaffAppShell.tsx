import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { useBrandingPortal } from "@/lib/branding";
import { Zap, Calendar, IndianRupee, User, Sparkles } from "lucide-react";

const staffNavItems: BottomNavItem[] = [
  { href: "/staff/dashboard", label: "Today", icon: Zap },
  { href: "/staff/daily-route", label: "Route", icon: Sparkles },
  { href: "/staff/jobs", label: "Jobs", icon: Calendar },
  { href: "/staff/earnings", label: "Earnings", icon: IndianRupee },
  { href: "/staff/profile", label: "Profile", icon: User },
];

const pageTitles: Record<string, string> = {
  "/staff/dashboard": "Today",
  "/staff/daily-route": "Daily Route",
  "/staff/daily-cleaning": "Daily Route",
  "/staff/jobs": "Jobs",
  "/staff/earnings": "Earnings",
  "/staff/profile": "Profile",
};

export default function StaffAppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const branding = useBrandingPortal("staff");

  const pageTitle =
    pageTitles[location] ??
    staffNavItems.find(item => location === item.href || location.startsWith(item.href + "/"))?.label ??
    "Staff";

  return (
    <AppShell
      testId="staff-app-shell"
      maxWidth="md"
      appBar={{
        leading: (
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo variant="mobile" imgClassName="h-8 w-8" fallbackClassName="w-8 h-8" lazy={false} />
          </div>
        ),
        title: pageTitle,
        subtitle: user?.name,
        trailing: <SyncStatusIndicator compact />,
      }}
      bottomNav={staffNavItems}
    >
      <PwaInstallBanner
        portalKey="staff"
        title={`Install ${branding.brandName} Staff`}
        description="Add the staff app to your home screen for one-tap access to today's jobs and earnings."
      />
      {children}
    </AppShell>
  );
}
