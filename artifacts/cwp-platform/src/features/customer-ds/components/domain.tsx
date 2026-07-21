import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, FileText, Download, Bell, MapPin, Calendar, ImageIcon, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTOMER_SPACE } from "../tokens";
import { CustomerCard } from "./primitives";
import { CustomerStatusBadge } from "./primitives";
import { CustomerButton } from "./CustomerButton";

/* ─── Booking ────────────────────────────────────────────── */

export function CustomerBookingCard({
  title,
  subtitle,
  status,
  when,
  where,
  href,
  onTrack,
  className,
}: {
  title: string;
  subtitle?: string;
  status: string;
  when?: string;
  where?: string;
  href?: string;
  onTrack?: () => void;
  className?: string;
}) {
  const body = (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold capitalize text-foreground truncate">{title}</p>
          {subtitle ? <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
        <CustomerStatusBadge status={status} className="shrink-0" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {when ? (
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={14} aria-hidden />
            {when}
          </span>
        ) : null}
        {where ? (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <MapPin size={14} className="shrink-0" aria-hidden />
            <span className="truncate">{where}</span>
          </span>
        ) : null}
      </div>
      {onTrack ? (
        <CustomerButton variant="outline" className="w-full" onClick={onTrack}>
          Track technician
        </CustomerButton>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={cn("block customer-card customer-elevated p-4 customer-transition hover:border-primary/25", className)} data-testid="customer-booking-card">
        {body}
      </Link>
    );
  }
  return (
    <div data-testid="customer-booking-card">
      <CustomerCard className={className}>{body}</CustomerCard>
    </div>
  );
}

/* ─── Service ────────────────────────────────────────────── */

export function CustomerServiceCard({
  title,
  description,
  icon,
  href,
  badge,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  href?: string;
  badge?: string;
  className?: string;
}) {
  const content = (
    <div className="flex items-center gap-3">
      {icon ? (
        <div className="customer-icon-well flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground truncate">{title}</p>
          {badge ? <CustomerStatusBadge status={badge} /> : null}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        ) : null}
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("customer-action-card block p-4", className)}
        data-testid="customer-service-card"
      >
        {content}
      </Link>
    );
  }
  return <CustomerCard className={className}>{content}</CustomerCard>;
}

/* ─── Subscription / Plan ────────────────────────────────── */

export function CustomerSubscriptionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("customer-card customer-elevated overflow-hidden", className)}
      data-testid="customer-subscription-card"
    >
      <div className={CUSTOMER_SPACE.cardPad}>{children}</div>
    </div>
  );
}

/* ─── Photo report ───────────────────────────────────────── */

export function CustomerPhotoReport({
  title,
  status = "completed",
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
  timeline,
  completedAt,
  className,
}: {
  title: string;
  status?: string;
  beforeUrl?: string | null;
  afterUrl?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  timeline?: ReactNode;
  completedAt?: string;
  className?: string;
}) {
  return (
    <article
      className={cn("customer-card customer-elevated overflow-hidden", className)}
      data-testid="customer-photo-report"
    >
      <div className={cn(CUSTOMER_SPACE.cardPad, "space-y-4")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{title}</p>
            {completedAt ? (
              <p className="text-xs text-muted-foreground mt-0.5">{completedAt}</p>
            ) : null}
          </div>
          <CustomerStatusBadge status={status} />
        </div>

        {(beforeUrl || afterUrl) && (
          <div className="customer-photo-pair">
            <figure className="min-w-0">
              {beforeUrl ? (
                <img src={beforeUrl} alt={beforeLabel} loading="lazy" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--customer-radius-sm)] bg-muted text-muted-foreground">
                  <ImageIcon size={20} aria-hidden />
                </div>
              )}
              <figcaption className="mt-1.5 text-center text-xs font-medium text-muted-foreground">
                {beforeLabel}
              </figcaption>
            </figure>
            <figure className="min-w-0">
              {afterUrl ? (
                <img src={afterUrl} alt={afterLabel} loading="lazy" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--customer-radius-sm)] bg-muted text-muted-foreground">
                  <ImageIcon size={20} aria-hidden />
                </div>
              )}
              <figcaption className="mt-1.5 text-center text-xs font-medium text-muted-foreground">
                {afterLabel}
              </figcaption>
            </figure>
          </div>
        )}

        {timeline}
      </div>
    </article>
  );
}

/* ─── Invoice ────────────────────────────────────────────── */

export function CustomerInvoiceCard({
  invoiceNumber,
  amount,
  date,
  status,
  dueAmount,
  onDownload,
  downloadSlot,
  className,
}: {
  invoiceNumber: string;
  amount: string;
  date?: string;
  status: string;
  dueAmount?: number;
  onDownload?: () => void;
  downloadSlot?: ReactNode;
  className?: string;
}) {
  const overdue = (dueAmount ?? 0) > 0;
  return (
    <div
      className={cn(
        "customer-card customer-elevated p-4",
        overdue && "border-destructive/30",
        className,
      )}
      data-testid="customer-invoice-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="customer-icon-well flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <FileText size={16} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{invoiceNumber}</p>
            <p className="font-semibold text-base mt-0.5">
              {amount}
              <span className="ml-1 text-xs font-normal text-muted-foreground">(GST incl.)</span>
            </p>
            {date ? <p className="text-xs text-muted-foreground">{date}</p> : null}
            {downloadSlot ??
              (onDownload ? (
                <button
                  type="button"
                  onClick={onDownload}
                  className="mt-1.5 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Download size={12} aria-hidden /> Download PDF
                </button>
              ) : null)}
          </div>
        </div>
        <CustomerStatusBadge status={status} className="shrink-0" />
      </div>
    </div>
  );
}

/* ─── Payment ────────────────────────────────────────────── */

export function CustomerPaymentCard({
  title,
  amount,
  method,
  date,
  status,
  className,
}: {
  title: string;
  amount: string;
  method?: string;
  date?: string;
  status: string;
  className?: string;
}) {
  return (
    <div className={cn("customer-card customer-elevated p-4", className)} data-testid="customer-payment-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="customer-icon-well flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <CreditCard size={16} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{title}</p>
            <p className="font-display text-lg font-bold tabular-nums mt-0.5">{amount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[method, date].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <CustomerStatusBadge status={status} className="shrink-0" />
      </div>
    </div>
  );
}

/* ─── Notification ───────────────────────────────────────── */

export function CustomerNotificationCard({
  title,
  body,
  time,
  unread,
  onClick,
  className,
}: {
  title: string;
  body?: string;
  time?: string;
  unread?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "customer-action-card flex w-full items-start gap-3 p-4 text-left",
        unread && "border-primary/25 bg-[color-mix(in_srgb,var(--customer-surface-tint)_55%,white)]",
        className,
      )}
      data-testid="customer-notification-card"
    >
      <div
        className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          unread ? "customer-icon-well" : "bg-muted text-muted-foreground",
        )}
      >
        <Bell size={16} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", unread ? "font-semibold" : "font-medium")}>
            {title}
          </p>
          {time ? <time className="shrink-0 text-[11px] text-muted-foreground">{time}</time> : null}
        </div>
        {body ? <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{body}</p> : null}
      </div>
    </button>
  );
}

export function CustomerNotificationGroup({
  label,
  children,
  className,
}: {
  label: "Today" | "Yesterday" | "Earlier" | string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)} data-testid="customer-notification-group">
      <h2 className="customer-notif-group-label">{label}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/* ─── Profile / Support ──────────────────────────────────── */

export function CustomerProfileCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("customer-card customer-elevated p-5", className)} data-testid="customer-profile-card">
      {children}
    </div>
  );
}

export function CustomerSupportCard({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("customer-card customer-elevated p-5 space-y-3", className)} data-testid="customer-support-card">
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
