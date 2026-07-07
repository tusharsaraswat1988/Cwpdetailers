import { ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { LocationStatusIndicator } from "@/lib/location/LocationStatusIndicator";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { Zap, ClipboardCheck, Sparkles, IndianRupee, User } from "lucide-react";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";

type StaffNavDef = BottomNavItem & { requiresRole?: string; requiresCategory?: "supervisor" | "cleaning_staff" };

const allStaffNavItems: StaffNavDef[] = [
  { href: "/staff/dashboard", label: "Dashboard", icon: Zap, requiresCategory: "cleaning_staff" },
  {
    href: "/staff/daily-clean",
    label: "Daily Clean",
    icon: Sparkles,
    requiresRole: OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER,
  },
  { href: "/staff/bookings", label: "Bookings", icon: ClipboardCheck, requiresCategory: "cleaning_staff" },
  {
    href: "/staff/earnings",
    label: "Coming soon",
    icon: IndianRupee,
    requiresCategory: "cleaning_staff",
    comingSoon: true,
  },
  { href: "/staff/profile", label: "Profile", icon: User },
];

const pageTitles: Record<string, string> = {
  "/staff/dashboard": "Dashboard",
  "/staff/daily-clean": "Daily Clean",
  "/staff/bookings": "Bookings",
  "/staff/daily-route": "Daily Clean",
  "/staff/daily-cleaning": "Daily Clean",
  "/staff/work": "Work",
  "/staff/jobs": "Jobs",
  "/staff/earnings": "Coming soon",
  "/staff/profile": "Profile",
};

export default function StaffAppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();

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
        subtitle: user?.name ? `${user.name}${myContext?.staffCategory === "supervisor" ? " · Supervisor" : ""}` : undefined,
        trailing: (
          <div className="flex items-center gap-1.5 shrink-0">
            <LocationStatusIndicator />
            <SyncStatusIndicator compact />
          </div>
        ),
      }}
      bottomNav={staffNavItems}
    >
      {children}
    </AppShell>
  );
}
