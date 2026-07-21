import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  MapPin,
  Phone,
  Navigation,
  ChevronRight,
  Camera,
  ImageIcon,
  CheckCircle2,
  Loader2,
  User,
  Bell,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STAFF_SPACE } from "../tokens";
import {
  StaffCard,
  StaffStatusBadge,
  StaffActionBar,
  StaffButton,
} from "./primitives";

/* ─── Job card ───────────────────────────────────────────── */

export function StaffJobCard({
  title,
  subtitle,
  status,
  when,
  where,
  amount,
  href,
  onClick,
  compact,
  phoneHref,
  navigateHref,
  trailing,
  className,
}: {
  title: string;
  subtitle?: string;
  status: string;
  when?: string;
  where?: string;
  amount?: string;
  href?: string;
  onClick?: () => void;
  compact?: boolean;
  phoneHref?: string;
  navigateHref?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  const body = (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold truncate text-foreground", compact ? "text-sm" : "text-base")}>
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{subtitle}</p>
          ) : null}
          {where && !compact ? (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} className="shrink-0" aria-hidden />
              <span className="truncate">{where}</span>
            </div>
          ) : null}
          {when && !where ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar size={12} aria-hidden />
              {when}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StaffStatusBadge status={status} />
          {amount ? <p className="text-sm font-semibold text-primary">{amount}</p> : null}
          {trailing}
          {href ? <ChevronRight size={16} className="mt-1 text-muted-foreground" aria-hidden /> : null}
        </div>
      </div>

      {!compact && (phoneHref || navigateHref) ? (
        <StaffActionBar>
          {phoneHref ? (
            <a
              href={phoneHref}
              onClick={e => e.stopPropagation()}
              className="staff-tap inline-flex items-center justify-center gap-1.5 rounded-[var(--staff-radius-sm)] border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Phone size={14} className="text-[hsl(var(--tone-success))]" aria-hidden />
              Call
            </a>
          ) : null}
          {navigateHref ? (
            <a
              href={navigateHref}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="staff-tap inline-flex items-center justify-center gap-1.5 rounded-[var(--staff-radius-sm)] border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Navigation size={14} aria-hidden />
              Navigate
            </a>
          ) : null}
        </StaffActionBar>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("staff-card staff-elevated block p-4 staff-transition hover:border-primary/35", className)}
        data-testid="staff-job-card"
      >
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("staff-card staff-elevated block w-full p-4 text-left staff-transition hover:border-primary/35", className)}
        data-testid="staff-job-card"
      >
        {body}
      </button>
    );
  }

  return (
    <div data-testid="staff-job-card">
      <StaffCard className={className}>{body}</StaffCard>
    </div>
  );
}

/* ─── Map / navigate card ────────────────────────────────── */

export function StaffMapCard({
  address,
  navigateHref,
  className,
}: {
  address: string;
  navigateHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-start gap-2 rounded-[var(--staff-radius)] bg-muted/50 p-3 text-sm text-muted-foreground", className)}
      data-testid="staff-map-card"
    >
      <MapPin size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">{address}</span>
      {navigateHref ? (
        <a
          href={navigateHref}
          target="_blank"
          rel="noreferrer"
          className="staff-tap inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 text-xs font-semibold text-primary"
        >
          <Navigation size={12} aria-hidden />
          Go
        </a>
      ) : null}
    </div>
  );
}

/* ─── Photo capture ──────────────────────────────────────── */

export type StaffPhotoSlotState = "empty" | "uploading" | "filled" | "failed";

export function StaffPhotoCapture({
  title = "Photos",
  slots,
  onCapture,
  className,
}: {
  title?: string;
  slots: {
    id: string;
    label: string;
    previewUrl?: string | null;
    state?: StaffPhotoSlotState;
  }[];
  onCapture?: (slotId: string) => void;
  className?: string;
}) {
  return (
    <section className={cn(STAFF_SPACE.section, className)} data-testid="staff-photo-capture">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="staff-photo-grid">
        {slots.map(slot => {
          const state = slot.state ?? (slot.previewUrl ? "filled" : "empty");
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!onCapture || state === "uploading"}
              onClick={() => onCapture?.(slot.id)}
              className="staff-photo-slot staff-tap staff-transition"
              data-filled={state === "filled" ? "true" : "false"}
              data-testid={`staff-photo-slot-${slot.id}`}
              aria-label={`${slot.label}${state === "filled" ? " captured" : ""}`}
            >
              {state === "uploading" ? (
                <Loader2 size={22} className="animate-spin text-primary" aria-hidden />
              ) : slot.previewUrl ? (
                <img src={slot.previewUrl} alt={slot.label} />
              ) : state === "failed" ? (
                <>
                  <ImageIcon size={20} className="text-destructive" aria-hidden />
                  <span className="text-[10px] font-medium text-destructive">Retry</span>
                </>
              ) : (
                <>
                  <Camera size={20} className="text-muted-foreground" aria-hidden />
                  <span className="text-[10px] font-medium text-muted-foreground">{slot.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function StaffPhotoPair({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: {
  beforeUrl?: string | null;
  afterUrl?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("staff-photo-pair", className)} data-testid="staff-photo-pair">
      <figure className="min-w-0">
        {beforeUrl ? (
          <img src={beforeUrl} alt={beforeLabel} loading="lazy" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--staff-radius-sm)] bg-muted text-muted-foreground">
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
          <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--staff-radius-sm)] bg-muted text-muted-foreground">
            <ImageIcon size={20} aria-hidden />
          </div>
        )}
        <figcaption className="mt-1.5 text-center text-xs font-medium text-muted-foreground">
          {afterLabel}
        </figcaption>
      </figure>
    </div>
  );
}

/* ─── Attendance ─────────────────────────────────────────── */

export function StaffAttendanceCard({
  status,
  dateLabel,
  checkInLabel,
  checkOutLabel,
  action,
  className,
}: {
  status: string;
  dateLabel?: string;
  checkInLabel?: string;
  checkOutLabel?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("staff-card staff-elevated", className)} data-testid="profile-attendance-today">
      <div className={cn(STAFF_SPACE.cardPad)}>
        <div className="flex items-start justify-between gap-3" data-testid="staff-attendance-card">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attendance
            </p>
            {dateLabel ? <p className="mt-0.5 text-sm text-foreground">{dateLabel}</p> : null}
            <div className="mt-2">
              <StaffStatusBadge status={status} />
            </div>
            {(checkInLabel || checkOutLabel) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {checkInLabel}
                {checkInLabel && checkOutLabel ? " · " : ""}
                {checkOutLabel}
              </p>
            )}
          </div>
          {action}
        </div>
      </div>
    </div>
  );
}

/* ─── Profile / notification / support ───────────────────── */

export function StaffProfileCard({
  name,
  role,
  avatarUrl,
  avatarFallback,
  status,
  children,
  className,
}: {
  name: string;
  role?: string;
  avatarUrl?: string | null;
  avatarFallback?: string;
  status?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <StaffCard className={className}>
      <div className="flex items-center gap-3" data-testid="staff-profile-card">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="staff-icon-well flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-bold">
            {avatarFallback ?? <User size={22} aria-hidden />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold truncate text-foreground">{name}</p>
          {role ? <p className="text-sm text-muted-foreground">{role}</p> : null}
          {status ? <div className="mt-1"><StaffStatusBadge status={status} /></div> : null}
        </div>
      </div>
      {children ? <div className="mt-4 space-y-3">{children}</div> : null}
    </StaffCard>
  );
}

export function StaffNotificationCard({
  title,
  body,
  time,
  unread,
  href,
  onClick,
  className,
}: {
  title: string;
  body?: string;
  time?: string;
  unread?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <div className="staff-icon-well flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Bell size={18} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>
            {title}
          </p>
          {time ? <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span> : null}
        </div>
        {body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{body}</p> : null}
      </div>
      {unread ? (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
      ) : null}
    </>
  );

  const classes = cn(
    "staff-action-card staff-tap flex w-full items-start gap-3 p-3.5 text-left",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} data-testid="staff-notification-card">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} data-testid="staff-notification-card">
      {content}
    </button>
  );
}

/** Success confirmation after photo / job complete. */
export function StaffSuccessBanner({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--staff-radius)] border border-[hsl(var(--tone-success)/0.3)] bg-[hsl(var(--tone-success)/0.08)] p-3",
        className,
      )}
      role="status"
      data-testid="staff-success-banner"
    >
      <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[hsl(var(--tone-success))]" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

export { StaffButton };
