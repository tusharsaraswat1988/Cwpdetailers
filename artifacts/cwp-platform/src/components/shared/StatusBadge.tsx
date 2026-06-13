import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  scheduled: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  en_route: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-500/10 text-green-700 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/20",
  rescheduled: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  paused: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  open: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  resolved: "bg-green-500/10 text-green-700 border-green-500/20",
  closed: "bg-muted text-muted-foreground border-border",
  active: "bg-green-500/10 text-green-700 border-green-500/20",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, label, pulse, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const display = label ?? status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
        statusStyles[normalized] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
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
