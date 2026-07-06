import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffDailyRouteSimplified } from "@/features/daily-cleaning/pages/StaffDailyRouteSimplified";

export default function StaffDailyCleanPage() {
  return (
    <StaffAppShell>
      <div className="space-y-3">
        <div>
          <h1 className="font-display font-bold text-xl">Daily Clean</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Aaj ke customers — photo lo, aage badho</p>
        </div>
        <StaffDailyRouteSimplified />
      </div>
    </StaffAppShell>
  );
}
