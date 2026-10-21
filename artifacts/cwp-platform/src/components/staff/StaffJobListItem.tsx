import { Link } from "wouter";
import type { StaffJob } from "@/lib/staff-jobs";
import { jobAmount } from "@/lib/staff-jobs";
import { formatStaffAddressLine } from "@/features/customers/lib/serviceAddress";
import { buildNavigateUrl, canNavigateTo } from "@/lib/maps";
import { StaffJobCard } from "@/features/staff-ds";

interface Props {
  job: StaffJob;
  compact?: boolean;
  showAmount?: boolean;
  linkToDashboard?: boolean;
}

export function StaffJobListItem({ job, compact, showAmount, linkToDashboard }: Props) {
  const isSolar =
    job.taskType === "solar_cleaning" ||
    job.serviceType?.toLowerCase().includes("solar") ||
    job.serviceName?.toLowerCase().includes("solar");
  const where = formatStaffAddressLine(job.address, job.area) || undefined;
  const subtitle = [
    (job.serviceName ?? job.serviceType)?.replace(/_/g, " "),
    job.scheduledTime,
  ]
    .filter(Boolean)
    .join(" · ");

  const card = (
    <StaffJobCard
      title={job.customerName ?? "Customer"}
      subtitle={subtitle}
      status={job.status ?? "scheduled"}
      where={where}
      compact={compact}
      trailing={
        isSolar ? (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            ☀️ Solar
          </span>
        ) : undefined
      }
      amount={
        showAmount && job.status === "completed" && jobAmount(job) > 0
          ? `₹${jobAmount(job).toLocaleString("en-IN")}`
          : undefined
      }
      phoneHref={job.customerPhone ? `tel:${job.customerPhone}` : undefined}
      navigateHref={canNavigateTo(job) ? buildNavigateUrl(job) : undefined}
      className={linkToDashboard ? undefined : undefined}
    />
  );

  if (linkToDashboard) {
    return (
      <Link href="/staff/dashboard" className="block" data-testid={`job-list-item-${job.id}`}>
        {card}
      </Link>
    );
  }

  return <div data-testid={`job-list-item-${job.id}`}>{card}</div>;
}
