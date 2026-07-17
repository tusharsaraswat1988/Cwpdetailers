import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineTone = "default" | "success" | "warning" | "destructive" | "info";

export type TimelineEvent = {
  id: string | number;
  title: string;
  description?: string;
  timestamp?: string;
  actor?: string;
  icon?: LucideIcon;
  tone?: TimelineTone;
};

interface TimelineProps {
  events: TimelineEvent[];
  emptyMessage?: string;
  className?: string;
}

const toneDot: Record<TimelineTone, string> = {
  default: "bg-muted-foreground",
  success: "bg-green-500",
  warning: "bg-amber-500",
  destructive: "bg-red-500",
  info: "bg-sky-500",
};

const toneRing: Record<TimelineTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-green-500/10 text-green-600",
  warning: "bg-amber-500/10 text-amber-600",
  destructive: "bg-red-500/10 text-red-600",
  info: "bg-sky-500/10 text-sky-600",
};

/**
 * The one timeline/activity-feed implementation for the admin panel — used
 * for booking, assignment, execution, job and commercial-billing history.
 * Do not build a page-specific feed; map your events into TimelineEvent[]
 * and render this instead.
 */
export function Timeline({ events, emptyMessage = "No activity yet", className }: TimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6" data-testid="timeline-empty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className={cn("relative", className)} data-testid="timeline">
      {events.map((event, i) => {
        const tone = event.tone ?? "default";
        const Icon = event.icon;
        const isLast = i === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                toneRing[tone],
              )}
              aria-hidden="true"
            >
              {Icon ? <Icon size={14} /> : <span className={cn("h-2 w-2 rounded-full", toneDot[tone])} />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-snug">{event.title}</p>
                {event.timestamp && (
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{event.timestamp}</span>
                )}
              </div>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
              )}
              {event.actor && (
                <p className="text-xs text-muted-foreground mt-1">by {event.actor}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default Timeline;
