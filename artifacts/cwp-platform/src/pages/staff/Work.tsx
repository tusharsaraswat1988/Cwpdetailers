import { Redirect, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { OPERATIONAL_ROLE_SLUGS } from "@/lib/staff-ecosystem/roles";

/** Legacy route — redirects to Daily Clean or Bookings. */
export default function StaffWorkPage() {
  const search = useSearch();
  const { user } = useAuth();
  const params = new URLSearchParams(search);
  const job = params.get("job");

  const { data: myRoles } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "my-roles"],
    queryFn: staffEcosystemApi.getMyOperationalRoles,
    enabled: Boolean(user?.staffId),
  });

  const canDailyClean = myRoles?.slugs.includes(OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER) ?? false;

  if (job || search.includes("tab=services")) {
    return <Redirect to={job ? `/staff/bookings?job=${encodeURIComponent(job)}` : "/staff/bookings"} />;
  }

  if (search.includes("tab=daily") || (canDailyClean && !search.includes("tab=services"))) {
    return <Redirect to="/staff/daily-clean" />;
  }

  return <Redirect to="/staff/bookings" />;
}
