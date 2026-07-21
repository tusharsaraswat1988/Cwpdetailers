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
import { Inbox, Loader2 } from "lucide-react";
import { CUSTOMER_SPACE, CUSTOMER_MOTION } from "../tokens";
import { CustomerButton } from "./CustomerButton";

/* ─── Page shell ─────────────────────────────────────────── */

export function CustomerPage({
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
      className={cn(CUSTOMER_SPACE.page, animate && CUSTOMER_MOTION.fadeIn, className)}
      data-testid="customer-page"
    >
      {children}
    </div>
  );
}

export function CustomerHeader({
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
      data-testid="customer-header"
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CustomerHero({
  eyebrow,
  title,
  subtitle,
  status,
  pulse,
  actions,
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: string;
  pulse?: boolean;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn("customer-hero px-4 py-4 sm:px-5 sm:py-5", className)}
      data-testid="customer-hero"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
        ) : (
          <span />
        )}
        {status && status !== "clear" ? (
          <CustomerStatusBadge status={status} pulse={pulse} className="shrink-0" />
        ) : null}
      </div>
      <p className="mt-1.5 font-display text-lg font-bold leading-snug capitalize text-foreground sm:text-xl">
        {title}
      </p>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      {children}
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

/* ─── Cards ──────────────────────────────────────────────── */

export function CustomerCard({
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
        "customer-card border-border bg-card shadow-none",
        elevated && "customer-elevated",
        className,
      )}
      data-testid="customer-card"
    >
      {padded ? <CardContent className={CUSTOMER_SPACE.cardPad}>{children}</CardContent> : children}
    </Card>
  );
}

export {
  CardHeader as CustomerCardHeader,
  CardTitle as CustomerCardTitle,
  CardDescription as CustomerCardDescription,
  CardContent as CustomerCardContent,
  CardFooter as CustomerCardFooter,
};

export function CustomerActionCard({
  icon,
  title,
  description,
  href,
  onClick,
  trailing,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      {icon ? (
        <div className="customer-icon-well flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground leading-snug">{title}</p>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{description}</p>
        ) : null}
      </div>
      {trailing}
    </>
  );

  const classes = cn(
    "customer-action-card customer-tap flex w-full items-center gap-3 p-4 text-left",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} data-testid="customer-action-card">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} data-testid="customer-action-card">
      {inner}
    </button>
  );
}

export function CustomerMetric({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-[var(--customer-radius,1rem)] border border-border bg-card p-4", className)}
      data-testid="customer-metric"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ─── Status / timeline ──────────────────────────────────── */

export function CustomerStatusBadge(
  props: React.ComponentProps<typeof StatusBadge>,
) {
  return <StatusBadge {...props} />;
}

export function CustomerTimeline({
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

export type { TimelineEvent as CustomerTimelineEvent };

/* ─── States ─────────────────────────────────────────────── */

export function CustomerEmptyState({
  icon,
  title,
  description,
  action,
  hint = "Pull to refresh, or try a different filter.",
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

export function CustomerErrorState({
  title = "Something went wrong",
  description = "Please try again. If it keeps happening, contact support.",
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

export function CustomerOfflineState(props: React.ComponentProps<typeof OfflineState>) {
  return <OfflineState {...props} />;
}

export function CustomerPermissionState(
  props: React.ComponentProps<typeof PermissionDeniedState>,
) {
  return <PermissionDeniedState {...props} />;
}

export function CustomerLoading({
  label = "Loading…",
  hint = "This usually takes a moment.",
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-2"
      data-testid="customer-loading"
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

export function CustomerSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("customer-skeleton rounded-[var(--customer-radius-sm)]", className)} aria-hidden />;
}

/* ─── Dialog / bottom action / stepper / tabs ────────────── */

export const CustomerDialog = ConfirmDialog;

export function CustomerBottomAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("customer-bottom-action", className)} data-testid="customer-bottom-action">
      {children}
    </div>
  );
}

export function CustomerStepper({
  step,
  totalSteps,
  title,
  children,
  className,
}: {
  step: number;
  totalSteps: number;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(CUSTOMER_SPACE.section, className)} data-testid="customer-stepper">
      <div className="flex items-center justify-between gap-3">
        {title ? <p className="font-display text-sm font-semibold">{title}</p> : <span />}
        <p className="text-xs tabular-nums text-muted-foreground">
          Step {step} of {totalSteps}
        </p>
      </div>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      >
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              "customer-transition h-1.5 flex-1 rounded-full",
              i < step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

export function CustomerTabs(props: React.ComponentProps<typeof Tabs>) {
  return <Tabs {...props} />;
}
export const CustomerTabsList = TabsList;
export const CustomerTabsTrigger = TabsTrigger;
export const CustomerTabsContent = TabsContent;

/* Re-export button for barrel convenience from primitives consumers */
export { CustomerButton };
