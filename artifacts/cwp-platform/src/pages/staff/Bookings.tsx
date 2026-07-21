import { useSearch } from "wouter";
import { StaffOtherServicesPanel } from "@/components/staff/StaffOtherServicesPanel";
import { StaffPage, StaffHeader } from "@/features/staff-ds";

export default function StaffBookingsPage() {
  const jobParam = new URLSearchParams(useSearch()).get("job");

  return (
    <StaffPage>
      <StaffHeader
        title="Today's Jobs"
        subtitle="Open a job — navigate, check in, capture photos, complete"
      />
      <StaffOtherServicesPanel
        selectedJobKey={jobParam}
        onSelectJob={key => {
          const path = key ? `/staff/bookings?job=${encodeURIComponent(key)}` : "/staff/bookings";
          window.history.replaceState(null, "", path);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      />
    </StaffPage>
  );
}
