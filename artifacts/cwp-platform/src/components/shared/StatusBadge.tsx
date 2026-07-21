import { cn } from "@/lib/utils";

export type StatusTone = "info" | "warning" | "success" | "destructive" | "neutral" | "progress";

/** Token-driven tones — CSS vars set by AdminThemeRoot; fallbacks for other portals. */
const toneStyles: Record<StatusTone, string> = {
  info: "bg-[hsl(var(--tone-info,212_100%_49%)/0.1)] text-[hsl(var(--tone-info-fg,212_100%_35%))] border-[hsl(var(--tone-info,212_100%_49%)/0.2)]",
  warning:
    "bg-[hsl(var(--tone-warning,38_92%_50%)/0.1)] text-[hsl(var(--tone-warning-fg,32_90%_32%))] border-[hsl(var(--tone-warning,38_92%_50%)/0.2)]",
  success:
    "bg-[hsl(var(--tone-success,142_71%_40%)/0.1)] text-[hsl(var(--tone-success-fg,142_72%_28%))] border-[hsl(var(--tone-success,142_71%_40%)/0.2)]",
  destructive:
    "bg-[hsl(var(--tone-destructive,0_84%_60%)/0.1)] text-[hsl(var(--tone-destructive-fg,0_72%_40%))] border-[hsl(var(--tone-destructive,0_84%_60%)/0.2)]",
  neutral: "bg-muted text-muted-foreground border-border",
  progress:
    "bg-[hsl(var(--tone-progress,262_60%_55%)/0.1)] text-[hsl(var(--tone-progress-fg,262_55%_38%))] border-[hsl(var(--tone-progress,262_60%_55%)/0.2)]",
};

const statusTone: Record<string, StatusTone> = {
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
  scheduled: "info",
  confirmed: "info",
  en_route: "warning",
  travelling: "warning",
  arrived: "info",
  checked_in: "info",
  in_progress: "progress",
  verified: "success",
  present: "success",
  absent: "destructive",
  late: "warning",
  half_day: "info",
  rescheduled: "progress",
  waiting: "warning",
  waiting_assignment: "warning",
  ready_for_execution: "progress",
  resolved: "success",
  closed: "neutral",
  active: "success",
  inactive: "neutral",
  escalated: "destructive",
  unpaid: "destructive",
  partially_paid: "warning",
  refunded: "progress",
  void: "neutral",
  voided: "neutral",
  issued: "info",
  sent: "info",
  payment_pending: "warning",
  commercially_closed: "success",
  accepted: "success",
  converted: "progress",
  expired: "neutral",
  offline: "neutral",
  sync_pending: "warning",
  uploading: "progress",
  upload_failed: "destructive",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        toneStyles[resolvedTone],
        className,
      )}
      data-testid="status-badge"
      data-status={normalized}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tone-success,142_71%_45%))] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tone-success,142_71%_45%))]" />
        </span>
      )}
      {display}
    </span>
  );
}

export default StatusBadge;
