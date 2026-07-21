import { Link } from "wouter";
import type { StaffJob } from "@/lib/staff-jobs";
import { jobAmount } from "@/lib/staff-jobs";
import { buildNavigateUrl, canNavigateTo } from "@/lib/maps";
import { StaffJobCard } from "@/features/staff-ds";

interface Props {
  job: StaffJob;
  compact?: boolean;
  showAmount?: boolean;
  linkToDashboard?: boolean;
}

export function StaffJobListItem({ job, compact, showAmount, linkToDashboard }: Props) {
  const where = job.area ? `${job.area}, ${job.address}` : job.address ?? undefined;
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
