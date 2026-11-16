import { ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { LocationStatusIndicator } from "@/lib/location/LocationStatusIndicator";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { Zap, Wrench, Sparkles, User, Globe } from "lucide-react";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { useStaffLanguage } from "@/lib/staffLanguage";

export default function StaffAppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { lang, setLang, t } = useStaffLanguage();

  const { data: myContext } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"],
    queryFn: staffEcosystemApi.getMyContext,
    enabled: Boolean(user?.staffId),
  });

  const staffNavItems: BottomNavItem[] = useMemo(() => {
    const isSupervisor = myContext?.staffCategory === "supervisor";

    if (isSupervisor) {
      return [
        { href: "/staff/dashboard", label: t("nav_dashboard"), icon: Zap },
        { href: "/staff/daily-clean", label: t("nav_dcms"), icon: Sparkles },
        { href: "/staff/bookings", label: t("nav_other_jobs"), icon: Wrench },
        { href: "/staff/profile", label: t("nav_account"), icon: User },
      ];
    }

    // Core 4-tab simplified navigation for field workers (Phase 3 & Phase 5)
    return [
      {
        href: "/staff/dashboard",
        label: t("nav_dashboard"),
        icon: Zap,
      },
      {
        href: "/staff/daily-clean",
        label: t("nav_dcms"),
        icon: Sparkles,
      },
      {
        href: "/staff/bookings",
        label: t("nav_other_jobs"),
        icon: Wrench,
      },
      {
        href: "/staff/profile",
        label: t("nav_account"),
        icon: User,
      },
    ];
  }, [myContext?.staffCategory, t]);

  const pageTitle = useMemo(() => {
    if (location.startsWith("/staff/dashboard")) return t("nav_dashboard");
    if (location.startsWith("/staff/daily-clean") || location.startsWith("/staff/daily-route")) return t("nav_dcms");
    if (location.startsWith("/staff/bookings") || location.startsWith("/staff/jobs")) return t("nav_other_jobs");
    if (location.startsWith("/staff/profile") || location.startsWith("/staff/earnings")) return t("nav_account");
    return "CWP Staff";
  }, [location, t]);

  const subtitle = useMemo(() => {
    if (!user?.name) return undefined;
    const parts = [user.name];
    if (myContext?.cityName) parts.push(myContext.cityName);
    if (myContext?.staffCategory === "supervisor") parts.push("Supervisor");
    return parts.join(" · ");
  }, [user?.name, myContext?.cityName, myContext?.staffCategory]);

  const toggleLanguage = () => {
    setLang(lang === "hi" ? "en" : "hi");
  };

  return (
    <AppShell
      testId="staff-app-shell"
      maxWidth="md"
      className="flex-1 min-h-0"
      appBar={{
        leading: (
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo variant="mobile" lazy={false} />
          </div>
        ),
        title: pageTitle,
        subtitle,
        trailing: (
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 1-tap Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg border border-border bg-card/80 hover:bg-muted text-foreground transition-colors shadow-none"
              title={lang === "hi" ? "Switch to English" : "हिन्दी में बदलें"}
              data-testid="staff-language-toggle"
            >
              <Globe size={13} className="text-primary" />
              <span>{lang === "hi" ? "EN" : "हिन्दी"}</span>
            </button>
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
