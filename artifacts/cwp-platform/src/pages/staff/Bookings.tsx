import { useSearch } from "wouter";
import { StaffOtherServicesPanel } from "@/components/staff/StaffOtherServicesPanel";
import { StaffPage, StaffHeader } from "@/features/staff-ds";
import { useStaffLanguage } from "@/lib/staffLanguage";

export default function StaffBookingsPage() {
  const jobParam = new URLSearchParams(useSearch()).get("job");
  const { t, isHindi } = useStaffLanguage();

  return (
    <StaffPage>
      <StaffHeader
        title={t("my_other_jobs_title")}
        subtitle={
          isHindi
            ? "काम चुनें — रास्ता देखें, फोटो खींचें और काम पूरा करें"
            : "Select a job — navigate, capture photos, complete"
        }
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
