import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  timestamp?: string;
};

interface ActivityFeedProps {
  items: ActivityItem[];
  emptyMessage?: string;
  className?: string;
}

export function ActivityFeed({ items, emptyMessage = "No recent activity", className }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground text-center py-6", className)}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("space-y-0", className)} data-testid="activity-feed">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 py-3",
              i < items.length - 1 && "border-b border-border",
            )}
          >
            {Icon && (
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted",
                  item.iconColor,
                )}
              >
                <Icon size={14} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
              )}
            </div>
            {item.timestamp && (
              <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                {item.timestamp}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;
