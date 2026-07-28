import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CreditCard, ClipboardList, Sparkles, History, Users } from "lucide-react";

const tabs = [
  { href: "/admin/daily-cleaning", label: "Dashboard", icon: LayoutDashboard, exact: true as const },
  { href: "/admin/daily-cleaning/subscriptions", label: "Subscriptions", icon: CreditCard, exact: false as const },
  { href: "/admin/daily-cleaning/history", label: "Service History", icon: History, exact: false as const },
  { href: "/admin/daily-cleaning/staff-performance", label: "Staff Performance", icon: Users, exact: false as const },
] as const;

export function DcmsAdminNav() {
  const [location] = useLocation();
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3 mb-1">
      <div className="flex items-center gap-2 mr-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-display font-bold text-lg">Daily Cleaning</span>
      </div>
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? location === href
          : location === href || location.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
