import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, CreditCard, MapPin, ClipboardList, Sparkles, Droplets, Users } from "lucide-react";
import { CustomerHubAdminNav } from "@/features/customers/components/CustomerHubAdminNav";

const tabs = [
  { href: "/admin/daily-cleaning", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/services?tab=dcms-plans", label: "Plans", icon: Package },
  { href: "/admin/daily-cleaning/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/daily-cleaning/visits", label: "Visits", icon: ClipboardList },
  { href: "/admin/daily-cleaning/washes", label: "Wash History", icon: Droplets },
  { href: "/admin/daily-cleaning/assignments", label: "Assignments", icon: MapPin },
  { href: "/admin/daily-cleaning/staff-performance", label: "Staff Performance", icon: Users },
];

export function DcmsAdminNav() {
  const [location] = useLocation();
  return (
    <div className="space-y-4 mb-1">
      <CustomerHubAdminNav />
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      <div className="flex items-center gap-2 mr-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-display font-bold text-lg">Daily Cleaning</span>
      </div>
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? location === href
          : href.includes("dcms-plans")
            ? location.includes("tab=dcms-plans") || location.startsWith("/admin/daily-cleaning/plans")
            : location.startsWith(href.split("?")[0]!);
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
    </div>
  );
}
