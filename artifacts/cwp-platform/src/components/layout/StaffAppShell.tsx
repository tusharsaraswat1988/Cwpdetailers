import { ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { LocationGate } from "@/lib/location";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { useBrandingPortal } from "@/lib/branding";
import { Zap, Calendar, IndianRupee, User, Sparkles, Users } from "lucide-react";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";

type StaffNavDef = BottomNavItem & { requiresRole?: string; requiresCategory?: "supervisor" | "cleaning_staff" };

const allStaffNavItems: StaffNavDef[] = [
  { href: "/staff/dashboard", label: "Today", icon: Zap, requiresCategory: "cleaning_staff" },
  { href: "/staff/team", label: "Team", icon: Users },
  { href: "/staff/daily-route", label: "Route", icon: Sparkles, requiresRole: OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER },
  { href: "/staff/jobs", label: "Jobs", icon: Calendar, requiresCategory: "cleaning_staff" },
  { href: "/staff/earnings", label: "Earnings", icon: IndianRupee, requiresCategory: "cleaning_staff" },
  { href: "/staff/profile", label: "Profile", icon: User },
];

const pageTitles: Record<string, string> = {
  "/staff/dashboard": "Today",
  "/staff/team": "Team",
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

  const { data: myRoles } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "my-roles"],
    queryFn: staffEcosystemApi.getMyOperationalRoles,
    enabled: Boolean(user?.staffId),
  });

  const { data: myContext } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"],
    queryFn: staffEcosystemApi.getMyContext,
    enabled: Boolean(user?.staffId),
  });

  const staffNavItems = useMemo(() => {
    const slugs = myRoles?.slugs ?? [];
    const category = myContext?.staffCategory ?? "cleaning_staff";
    return allStaffNavItems.filter(item => {
      if (item.requiresCategory && item.requiresCategory !== category) return false;
      if (item.requiresRole && !slugs.includes(item.requiresRole)) return false;
      return true;
    });
  }, [myRoles?.slugs, myContext?.staffCategory]);

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
            <BrandLogo variant="mobile" lazy={false} />
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
      <LocationGate>{children}</LocationGate>
    </AppShell>
  );
}
