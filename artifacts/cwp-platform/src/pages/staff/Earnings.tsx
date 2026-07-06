import StaffAppShell from "@/components/layout/StaffAppShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { IndianRupee } from "lucide-react";

export default function StaffEarnings() {
  return (
    <StaffAppShell>
      <EmptyState
        icon={<IndianRupee size={20} />}
        title="Coming soon"
        description="Earnings tracking is on the way. You'll see completed job payouts and monthly summaries here."
      />
    </StaffAppShell>
  );
}
