import { cn } from "@/lib/utils";
import { StatCard } from "./StatCard";
import type { LucideIcon } from "lucide-react";
import type { StatCardTone, StatCardTrend } from "./StatCard";

export type KpiItem = {
  id: string;
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: string;
  subtitle?: string;
  trend?: StatCardTrend;
  tone?: StatCardTone;
  prominent?: boolean;
  href?: string;
  onClick?: () => void;
};

interface KpiRowProps {
  items: KpiItem[];
  isLoading?: boolean;
  /** Column count at the lg breakpoint — defaults to items.length capped at 5. */
  columns?: number;
  className?: string;
}

/**
 * The one KPI-row layout for the admin panel — a responsive grid of
 * StatCards. Use on Dashboard, Analytics, and any module queue-count strip
 * instead of a page-specific grid of ad-hoc cards.
 */
export function KpiRow({ items, isLoading, columns, className }: KpiRowProps) {
  if (items.length === 0 && !isLoading) return null;
  const lgCols = columns ?? Math.min(items.length, 5);

  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4",
        lgCols === 3 && "lg:grid-cols-3",
        lgCols === 5 && "xl:grid-cols-5",
        lgCols >= 6 && "xl:grid-cols-6",
        className,
      )}
      data-testid="kpi-row"
    >
      {items.map(item => (
        <StatCard
          key={item.id}
          label={item.label}
          value={item.value}
          icon={item.icon}
          delta={item.delta}
          subtitle={item.subtitle}
          trend={item.trend}
          tone={item.tone}
          prominent={item.prominent}
          href={item.href}
          isLoading={isLoading}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}

export default KpiRow;
