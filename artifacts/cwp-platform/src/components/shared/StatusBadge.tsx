import { cn } from "@/lib/utils";

export type StatusTone = "info" | "warning" | "success" | "destructive" | "neutral" | "progress";

const toneStyles: Record<StatusTone, string> = {
  info: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  success: "bg-green-500/10 text-green-700 border-green-500/20",
  destructive: "bg-red-500/10 text-red-700 border-red-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
  progress: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

/**
 * Single source of truth for status → color across every admin module
 * (bookings, jobs, assignments, invoices, attendance, leads, complaints).
 * Extend this map instead of introducing a new local status color map in
 * feature code — see docs/PHASE_6_ADMIN_UX_CONSOLIDATION.md and
 * docs/UI_CONSTITUTION.md.
 *
 * Covers the universal status vocabulary: open, pending, assigned, ready,
 * started, paused, completed, cancelled, approved, rejected, paid, draft,
 * outstanding, overdue, blocked, warning, success, error — plus the
 * domain-specific synonyms already in use across modules today.
 */
const statusTone: Record<string, StatusTone> = {
  // Universal lifecycle vocabulary
  open: "info",
  pending: "warning",
  assigned: "info",
  ready: "progress",
  started: "progress",
  paused: "warning",
  completed: "success",
  cancelled: "destructive",
  approved: "success",
  rejected: "destructive",
  paid: "success",
  draft: "neutral",
  outstanding: "warning",
  overdue: "destructive",
  blocked: "destructive",
  warning: "warning",
  success: "success",
  error: "destructive",
  // Scheduling / bookings synonyms
  scheduled: "info",
  confirmed: "info",
  en_route: "warning",
  in_progress: "progress",
  rescheduled: "progress",
  // Generic lifecycle synonyms (jobs, complaints, leads, subscriptions)
  waiting: "warning",
  waiting_assignment: "warning",
  ready_for_execution: "progress",
  resolved: "success",
  closed: "neutral",
  active: "success",
  inactive: "neutral",
  escalated: "destructive",
  // Billing / invoice synonyms
  unpaid: "destructive",
  partially_paid: "warning",
  refunded: "progress",
  void: "neutral",
  voided: "neutral",
  issued: "info",
  sent: "info",
  payment_pending: "warning",
  commercially_closed: "success",
  // Quotation lifecycle synonyms
  accepted: "success",
  converted: "progress",
  expired: "neutral",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  /** Override the tone lookup when a status string isn't in the map yet. */
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, label, tone, pulse, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const display = label ?? status.replace(/_/g, " ");
  const resolvedTone = tone ?? statusTone[normalized] ?? "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
        toneStyles[resolvedTone],
        className,
      )}
      data-testid="status-badge"
      data-status={normalized}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      )}
      {display}
    </span>
  );
}

export default StatusBadge;
