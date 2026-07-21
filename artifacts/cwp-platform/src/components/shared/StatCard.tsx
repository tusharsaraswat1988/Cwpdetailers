import { LucideIcon, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type StatCardTrend = "up" | "down" | "neutral";
export type StatCardTone = "default" | "success" | "warning" | "destructive";

interface StatCardProps {
  label: string;
  value: ReactValue;
  icon?: LucideIcon;
  /** e.g. "+12% vs last month" */
  delta?: string;
  subtitle?: string;
  trend?: StatCardTrend;
  /** Tints the value + icon chip — use for "needs attention" style KPIs (e.g. overdue counts). */
  tone?: StatCardTone;
  /** Larger tile for the top-priority KPI row. */
  prominent?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  /** Renders the tile as a link instead of/alongside onClick. */
  href?: string;
  className?: string;
}

type ReactValue = string | number;

const trendColor: Record<StatCardTrend, string> = {
  up: "text-[hsl(var(--tone-success-fg,142_72%_28%))]",
  down: "text-[hsl(var(--tone-destructive-fg,0_72%_40%))]",
  neutral: "text-muted-foreground",
};

const toneColor: Record<StatCardTone, string> = {
  default: "text-foreground",
  success: "text-[hsl(var(--tone-success-fg,142_72%_28%))]",
  warning: "text-[hsl(var(--tone-warning-fg,32_90%_32%))]",
  destructive: "text-destructive",
};

const toneIconColor: Record<StatCardTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-[hsl(var(--tone-success,142_71%_40%)/0.1)] text-[hsl(var(--tone-success-fg,142_72%_28%))]",
  warning: "bg-[hsl(var(--tone-warning,38_92%_50%)/0.1)] text-[hsl(var(--tone-warning-fg,32_90%_32%))]",
  destructive: "bg-destructive/10 text-destructive",
};

/**
 * The one KPI-tile implementation for the admin panel (Dashboard, Analytics,
 * Job Orchestration queue counts, etc). Extend via props rather than
 * hand-rolling a new stat card per page.
 */
export function StatCard({
  label, value, icon: Icon, delta, subtitle, trend = "neutral", tone = "default",
  prominent, isLoading, onClick, href, className,
}: StatCardProps) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : undefined;
  const interactive = !!onClick || !!href;

  const content = (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]",
        prominent ? "p-5 sm:p-6" : "p-4 sm:p-5",
        interactive && "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      tabIndex={onClick && !href ? 0 : undefined}
      role={onClick && !href ? "button" : undefined}
      data-testid="stat-card"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
        {Icon && (
          <span className={cn(
            "flex shrink-0 items-center justify-center rounded-xl",
            prominent ? "w-12 h-12" : "w-10 h-10",
            toneIconColor[tone],
          )}>
            <Icon size={prominent ? 22 : 18} />
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-20 mt-2" />
      ) : (
        <p className={cn(
          "font-display font-bold mt-1 tabular-nums",
          prominent ? "text-3xl" : "text-2xl",
          toneColor[tone],
        )}>
          {value}
        </p>
      )}
      {subtitle && !isLoading && <p className="text-muted-foreground text-xs mt-1">{subtitle}</p>}
      {delta && !isLoading && (
        <p className={cn("text-xs mt-1 flex items-center gap-1", trendColor[trend])}>
          {TrendIcon && <TrendIcon size={12} />}
          {delta}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block hover:opacity-95 transition-opacity">{content}</Link>;
  }
  return content;
}

export default StatCard;
