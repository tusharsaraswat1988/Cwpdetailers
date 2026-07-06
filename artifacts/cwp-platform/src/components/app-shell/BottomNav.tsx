import { Link, useLocation } from "wouter";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BottomNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Center elevated action (e.g. Book) */
  fab?: boolean;
  /** Disabled preview — muted tab, no active highlight */
  comingSoon?: boolean;
};

interface BottomNavProps {
  items: BottomNavItem[];
  testId?: string;
}

export function BottomNav({ items, testId = "bottom-nav" }: BottomNavProps) {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur safe-area-bottom"
      aria-label="Main navigation"
      data-testid={testId}
    >
      <div
        className="flex items-stretch justify-around max-w-lg mx-auto px-1"
        style={{ height: "var(--bottom-nav-height)" }}
      >
        {items.map(({ href, label, icon: Icon, fab, comingSoon }) => {
          const active = !comingSoon && (location === href || location.startsWith(href + "/"));
          if (fab) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-end pb-1 -mt-3 min-w-[4rem]"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all",
                    active
                      ? "bg-primary text-primary-foreground scale-105"
                      : "bg-primary text-primary-foreground hover:scale-105",
                  )}
                >
                  <Icon size={24} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-medium text-primary mt-1">{label}</span>
              </Link>
            );
          }
          if (comingSoon) {
            return (
              <span
                key={href}
                aria-label={`${label} — coming soon`}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[var(--bottom-nav-height)] py-1 text-muted-foreground/60 cursor-default"
              >
                <Icon size={22} strokeWidth={2} className="shrink-0" />
                <span className="text-[9px] leading-tight text-center">{label}</span>
              </span>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[var(--bottom-nav-height)] py-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 2}
                className="shrink-0"
              />
              <span className={cn("text-[10px] leading-tight", active && "font-semibold")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
