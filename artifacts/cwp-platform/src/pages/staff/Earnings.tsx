import { IndianRupee } from "lucide-react";
import { StaffPage, StaffHeader, StaffEmptyState } from "@/features/staff-ds";

export default function StaffEarnings() {
  return (
    <StaffPage>
      <StaffHeader title="Earnings" subtitle="Payouts and monthly summaries" />
      <StaffEmptyState
        icon={<IndianRupee size={20} aria-hidden />}
        title="Coming soon"
        description="Earnings tracking is on the way. You'll see completed job payouts and monthly summaries here."
        hint="Check back after your next completed jobs."
      />
    </StaffPage>
  );
}
