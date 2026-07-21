import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { OfflineState } from "@/components/shared/OfflineState";
import { PermissionDeniedState } from "@/components/shared/PermissionDeniedState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Timeline, type TimelineEvent } from "@/components/shared/Timeline";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Inbox, Loader2, CloudOff, RefreshCw, Upload, AlertTriangle } from "lucide-react";
import { STAFF_SPACE, STAFF_MOTION } from "../tokens";
import { StaffButton } from "./StaffButton";

/* ─── Page shell ─────────────────────────────────────────── */

export function StaffPage({
  children,
  className,
  animate = true,
}: {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}) {
  return (
    <div
      className={cn(STAFF_SPACE.page, animate && STAFF_MOTION.fadeIn, className)}
      data-testid="staff-page"
    >
      {children}
    </div>
  );
}

export function StaffHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("flex items-start justify-between gap-3", className)}
      data-testid="staff-header"
    >
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Dashboard greeting + “what’s next” framing. */
export function StaffDashboard({
  greeting,
  dateLabel,
  children,
  className,
}: {
  greeting: string;
  dateLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(STAFF_SPACE.section, className)} data-testid="staff-dashboard">
      <div>
        <p className="font-display text-xl font-bold leading-tight text-foreground">{greeting}</p>
        {dateLabel ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ─── Cards ──────────────────────────────────────────────── */

export function StaffCard({
  children,
  className,
  padded = true,
  elevated = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  elevated?: boolean;
}) {
  return (
    <Card
      className={cn(
        "staff-card border-border bg-card shadow-none",
        elevated && "staff-elevated",
        className,
      )}
      data-testid="staff-card"
    >
      {padded ? <CardContent className={STAFF_SPACE.cardPad}>{children}</CardContent> : children}
    </Card>
  );
}

export {
  CardHeader as StaffCardHeader,
  CardTitle as StaffCardTitle,
  CardDescription as StaffCardDescription,
  CardContent as StaffCardContent,
  CardFooter as StaffCardFooter,
};

export function StaffMetric({
  label,
  value,
  hint,
  icon,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning";
  className?: string;
}) {
  const valueTone =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-[hsl(var(--tone-success-fg,142_72%_28%))]"
        : tone === "warning"
          ? "text-[hsl(var(--tone-warning-fg,32_90%_32%))]"
          : "text-foreground";

  return (
    <div
      className={cn(
        "flex-1 rounded-[var(--staff-radius,1rem)] border border-border bg-card p-3 text-center",
        className,
      )}
      data-testid="staff-metric"
    >
      {icon ? <div className="mb-1 flex justify-center text-muted-foreground">{icon}</div> : null}
      <p className={cn("font-display text-lg font-bold tabular-nums", valueTone)}>{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StaffProgressCard({
  title,
  value,
  max,
  hint,
  className,
}: {
  title: string;
  value: number;
  max: number;
  hint?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={cn("staff-card staff-elevated p-4 space-y-2", className)}
      data-testid="staff-progress-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {value}/{max}
        </p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={title}
      >
        <div
          className="staff-transition h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ─── Status / timeline ──────────────────────────────────── */

export function StaffStatusBadge(props: React.ComponentProps<typeof StatusBadge>) {
  return <StatusBadge {...props} />;
}

export function StaffTimeline({
  events,
  emptyMessage = "No activity yet",
  className,
}: {
  events: TimelineEvent[];
  emptyMessage?: string;
  className?: string;
}) {
  return <Timeline events={events} emptyMessage={emptyMessage} className={className} />;
}

export type { TimelineEvent as StaffTimelineEvent };

/* ─── Action bars ────────────────────────────────────────── */

export function StaffActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("staff-action-bar", className)} data-testid="staff-action-bar">
      {children}
    </div>
  );
}

export function StaffBottomActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("staff-bottom-actions", className)} data-testid="staff-bottom-actions">
      {children}
    </div>
  );
}

/* ─── Checklist ──────────────────────────────────────────── */

export function StaffChecklist({
  items,
  className,
}: {
  items: { id: string; label: string; done?: boolean; trailing?: ReactNode }[];
  className?: string;
}) {
  return (
    <ul className={cn("staff-checklist", className)} data-testid="staff-checklist">
      {items.map(item => (
        <li key={item.id} className="staff-checklist-item" data-done={item.done ? "true" : "false"}>
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
              item.done
                ? "border-[hsl(var(--tone-success)/0.4)] bg-[hsl(var(--tone-success)/0.15)] text-[hsl(var(--tone-success-fg))]"
                : "border-border text-muted-foreground",
            )}
            aria-hidden
          >
            {item.done ? "✓" : ""}
          </span>
          <span className={cn("flex-1 text-sm font-medium", item.done && "text-muted-foreground")}>
            {item.label}
          </span>
          {item.trailing}
        </li>
      ))}
    </ul>
  );
}

/* ─── Sync / offline chips ───────────────────────────────── */

const syncMeta = {
  offline: { icon: CloudOff, label: "Offline", className: "border-border text-muted-foreground bg-muted" },
  sync_pending: {
    icon: RefreshCw,
    label: "Sync pending",
    className:
      "border-[hsl(var(--tone-warning)/0.35)] text-[hsl(var(--tone-warning-fg))] bg-[hsl(var(--tone-warning)/0.1)]",
  },
  uploading: {
    icon: Upload,
    label: "Uploading",
    className:
      "border-[hsl(var(--tone-progress)/0.35)] text-[hsl(var(--tone-progress-fg))] bg-[hsl(var(--tone-progress)/0.1)]",
  },
  upload_failed: {
    icon: AlertTriangle,
    label: "Upload failed",
    className:
      "border-[hsl(var(--tone-destructive)/0.35)] text-[hsl(var(--tone-destructive-fg))] bg-[hsl(var(--tone-destructive)/0.1)]",
  },
  retry: {
    icon: RefreshCw,
    label: "Retry",
    className: "border-primary/30 text-primary bg-primary/5",
  },
} as const;

export function StaffSyncChip({
  state,
  onRetry,
  className,
}: {
  state: keyof typeof syncMeta;
  onRetry?: () => void;
  className?: string;
}) {
  const meta = syncMeta[state];
  const Icon = meta.icon;
  if (state === "retry" || (state === "upload_failed" && onRetry)) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={cn("staff-sync-chip staff-tap", meta.className, className)}
        data-testid="staff-sync-chip"
      >
        <Icon size={12} aria-hidden />
        {state === "upload_failed" ? "Retry upload" : meta.label}
      </button>
    );
  }
  return (
    <span className={cn("staff-sync-chip", meta.className, className)} data-testid="staff-sync-chip">
      <Icon size={12} aria-hidden />
      {meta.label}
    </span>
  );
}

/* ─── States ─────────────────────────────────────────────── */

export function StaffEmptyState({
  icon,
  title,
  description,
  action,
  hint = "Pull to refresh, or check another tab.",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  hint?: string;
}) {
  return (
    <EmptyState
      icon={icon ?? <Inbox size={20} aria-hidden />}
      title={title}
      description={description}
      action={action}
      hint={hint}
    />
  );
}

export function StaffErrorState({
  title = "Something went wrong",
  description = "Try again. If it keeps happening, contact your supervisor.",
  onRetry,
  action,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <ErrorState title={title} description={description} onRetry={onRetry} action={action} />
  );
}

export function StaffOfflineState(props: React.ComponentProps<typeof OfflineState>) {
  return <OfflineState {...props} />;
}

export function StaffPermissionState(
  props: React.ComponentProps<typeof PermissionDeniedState>,
) {
  return <PermissionDeniedState {...props} />;
}

export function StaffLoading({
  label = "Loading…",
  hint = "This usually takes a moment.",
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-2"
      data-testid="staff-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function StaffSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("staff-skeleton rounded-[var(--staff-radius-sm)]", className)} aria-hidden />
  );
}

/* ─── Dialog / drawer / tabs ─────────────────────────────── */

export const StaffDialog = ConfirmDialog;

export function StaffDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[var(--staff-radius-xl)]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function StaffTabs(props: React.ComponentProps<typeof Tabs>) {
  return <Tabs {...props} />;
}
export const StaffTabsList = TabsList;
export const StaffTabsTrigger = TabsTrigger;
export const StaffTabsContent = TabsContent;

export { StaffButton };
export { Link };
export { cn };
