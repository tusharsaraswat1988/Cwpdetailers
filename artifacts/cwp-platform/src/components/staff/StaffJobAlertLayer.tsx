import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetTodayBookings, getGetTodayBookingsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useStaffJobAlerts, useStaffPushMessageAlerts } from "@/hooks/useStaffJobAlerts";
import { useStaffPushAutoSubscribe } from "@/hooks/useStaffPushAutoSubscribe";
import { StaffJobAlertPopup } from "@/components/staff/StaffJobAlertPopup";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { fetchTodayExecutions } from "@/features/service-executions/api";
import { executionToStaffJob, type StaffJob } from "@/lib/staff-jobs";

/** Polls today's jobs and surfaces vibration + popup when admin assigns new work. */
export function StaffJobAlertLayer({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const staffId = user?.staffId;

  const { data: myContext } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "me-context"],
    queryFn: staffEcosystemApi.getMyContext,
    enabled: user?.role === "staff" && staffId != null,
  });

  const enabled =
    user?.role === "staff" &&
    staffId != null &&
    myContext?.staffCategory !== "supervisor";

  const { data: todayBookings } = useGetTodayBookings(
    { staffId: staffId ?? 0 },
    {
      query: {
        queryKey: getGetTodayBookingsQueryKey({ staffId: staffId ?? 0 }),
        enabled: enabled && staffId != null,
        refetchInterval: 30_000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
      },
    },
  );

  const { data: todayExecutions } = useQuery({
    queryKey: ["service-executions", "today", staffId],
    queryFn: fetchTodayExecutions,
    enabled: enabled && staffId != null,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const todayJobs: StaffJob[] = [
    ...((todayBookings ?? []) as StaffJob[]).map(j => ({ ...j, source: "booking" as const })),
    ...((todayExecutions ?? []).map(executionToStaffJob)),
  ];

  const { latestAlert, dismissAlert } = useStaffJobAlerts(todayJobs, Boolean(enabled));
  useStaffPushMessageAlerts(Boolean(enabled));
  useStaffPushAutoSubscribe(Boolean(enabled));

  return (
    <>
      <StaffJobAlertPopup alert={latestAlert} onDismiss={dismissAlert} />
      {children}
    </>
  );
}
