import { StaffDailyRouteSimplified } from "@/features/daily-cleaning/pages/StaffDailyRouteSimplified";
import { StaffPage, StaffHeader } from "@/features/staff-ds";

export default function StaffDailyCleanPage() {
  return (
    <StaffPage className="space-y-3">
      <StaffHeader
        title="Daily Clean"
        subtitle="Today's route — plate scan, photos, move on"
      />
      <StaffDailyRouteSimplified />
    </StaffPage>
  );
}
