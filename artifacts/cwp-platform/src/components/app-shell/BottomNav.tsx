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
      className="fixed bottom-0 inset-x-0 z-30 border-t border-border/80 bg-card/95 backdrop-blur-md safe-area-bottom md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.03)]"
      aria-label="Main navigation"
      data-testid={testId}
    >
      <div
        className="flex items-center justify-around max-w-lg mx-auto px-2 h-16"
      >
        {items.map(({ href, label, icon: Icon, fab, comingSoon }) => {
          const active = !comingSoon && (location === href || (href !== "/customer/dashboard" && location.startsWith(href + "/")));
          if (fab) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center min-w-[3.5rem] py-1 transition-transform active:scale-95"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-sm",
                    active
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                      : "bg-primary/90 text-primary-foreground hover:bg-primary",
                  )}
                >
                  <Icon size={19} strokeWidth={2.2} />
                </div>
                <span className={cn("text-[10px] leading-none mt-1", active ? "font-semibold text-primary" : "font-medium text-muted-foreground")}>
                  {label}
                </span>
              </Link>
            );
          }
          if (comingSoon) {
            return (
              <span
                key={href}
                aria-label={`${label} — coming soon`}
                className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 min-h-[3.5rem] py-1 text-muted-foreground/40 cursor-default px-1"
              >
                <Icon size={19} strokeWidth={2} className="shrink-0" />
                <span className="text-[10px] leading-none text-center truncate max-w-full">{label}</span>
              </span>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 min-w-0 min-h-[3.5rem] py-1 transition-colors px-1 relative",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute -top-1 w-5 h-0.5 rounded-full bg-primary" aria-hidden />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 2}
                className="shrink-0"
              />
              <span className={cn("text-[10px] leading-none truncate max-w-full text-center", active ? "font-semibold text-primary" : "font-medium")}>
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
