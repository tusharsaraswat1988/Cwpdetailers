import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { BrandLoader } from "@/lib/branding";
import { StaffLayout } from "@/components/layout/StaffLayout";
import StaffDashboard from "@/pages/staff/Dashboard";
import StaffDailyClean from "@/pages/staff/DailyClean";
import StaffBookings from "@/pages/staff/Bookings";
import StaffJobs from "@/pages/staff/Jobs";
import StaffEarnings from "@/pages/staff/Earnings";
import StaffProfile from "@/pages/staff/Profile";
import StaffWork from "@/pages/staff/Work";
import StaffTeam from "@/pages/staff/Team";
import NotFound from "@/pages/not-found";

const STAFF_PAGES: Record<string, React.ComponentType> = {
  "/staff/dashboard": StaffDashboard,
  "/staff/daily-clean": StaffDailyClean,
  "/staff/bookings": StaffBookings,
  "/staff/jobs": StaffJobs,
  "/staff/earnings": StaffEarnings,
  "/staff/profile": StaffProfile,
  "/staff/work": StaffWork,
  "/staff/team": StaffTeam,
};

/**
 * One router entry for all authenticated staff routes.
 * StaffLayout (and LocationProvider) remain mounted during tab navigation.
 */
export default function StaffPortalRouter() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();

  if (location === "/staff/daily-route" || location === "/staff/daily-cleaning") {
    return <Redirect to="/staff/daily-clean" />;
  }
  if (location === "/staff/schedule") {
    return <Redirect to="/staff/jobs" />;
  }
  if (location === "/staff/attendance" || location === "/staff/performance") {
    return <Redirect to="/staff/profile" />;
  }

  if (isLoading) return <BrandLoader fullScreen />;
  if (!user || user.role !== "staff") return <Redirect to="/staff/login" />;

  const Page = STAFF_PAGES[location];
  if (!Page) {
    return (
      <StaffLayout>
        <NotFound />
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <Page />
    </StaffLayout>
  );
}
