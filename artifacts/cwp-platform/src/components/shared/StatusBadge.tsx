import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Info,
  RotateCw,
  Minus,
} from "lucide-react";

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
  pending_customer_approval: "warning",
  customer_approved: "success",
  otp_verified: "success",
  assigned: "info",
  ready: "progress",
  started: "progress",
  paused: "warning",
  completed: "success",
  cancelled: "destructive",
  approved: "success",
  rejected: "destructive",
  car_not_available: "warning",
  missed: "destructive",
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
  checked_in: "success",
  not_checked_in: "warning",
  checking_in: "progress",
  failed: "destructive",
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
  icon?: ReactNode;
  showIcon?: boolean;
}

export function getStatusIcon(status: string, tone: StatusTone): ReactNode {
  switch (status) {
    case "completed":
    case "checked_in":
    case "verified":
    case "approved":
    case "active":
    case "accepted":
    case "customer_approved":
    case "otp_verified":
    case "present":
      return <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case "pending":
    case "scheduled":
    case "waiting":
    case "waiting_assignment":
    case "not_checked_in":
    case "payment_pending":
    case "late":
      return <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case "in_progress":
    case "started":
    case "en_route":
    case "travelling":
    case "checking_in":
    case "uploading":
      return <RotateCw className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />;
    case "car_not_available":
    case "warning":
    case "sync_pending":
    case "paused":
      return <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case "cancelled":
    case "rejected":
    case "missed":
    case "absent":
    case "failed":
    case "upload_failed":
      return <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />;
    default:
      if (tone === "success") return <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />;
      if (tone === "warning") return <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />;
      if (tone === "destructive") return <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />;
      if (tone === "progress") return <RotateCw className="h-3 w-3 shrink-0" aria-hidden="true" />;
      if (tone === "info") return <Info className="h-3 w-3 shrink-0" aria-hidden="true" />;
      return <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />;
  }
}

export function StatusBadge({
  status,
  label,
  tone,
  pulse,
  className,
  icon,
  showIcon = true,
}: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const display = label ?? status.replace(/_/g, " ");
  const resolvedTone = tone ?? statusTone[normalized] ?? "neutral";
  const iconNode = showIcon !== false ? (icon ?? getStatusIcon(normalized, resolvedTone)) : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize tracking-tight leading-normal",
        toneStyles[resolvedTone],
        className,
      )}
      data-testid="status-badge"
      data-status={normalized}
    >
      {pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tone-success,142_71%_45%))] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tone-success,142_71%_45%))]" />
        </span>
      ) : (
        iconNode
      )}
      {display}
    </span>
  );
}

export default StatusBadge;
