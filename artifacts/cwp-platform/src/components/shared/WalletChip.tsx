import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface PlanChipProps {
  remainingVisits: number;
  href?: string;
  lowRemaining?: boolean;
  className?: string;
}

/** Shows remaining plan visits — replaces legacy WalletChip (₹ balance). */
export function PlanChip({ remainingVisits, href = CUSTOMER_ROUTES.plans, lowRemaining, className }: PlanChipProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums transition-colors",
        lowRemaining
          ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
          : "bg-primary/10 text-primary border border-primary/20",
        href && "hover:bg-primary/15",
        className,
      )}
    >
      <ClipboardList size={12} />
      {remainingVisits} left
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

/** @deprecated Use PlanChip — kept for import compatibility. */
export const WalletChip = PlanChip;

export default PlanChip;
