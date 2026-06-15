import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import {
  CUSTOMER_HUB_CHILDREN,
  isAdminNavItemActive,
} from "@/components/layout/adminNavConfig";
import { useAuth } from "@/lib/auth";

/** In-page tabs for customer-related admin screens. */
export function CustomerHubAdminNav() {
  const [location] = useLocation();
  const { hasPermission } = useAuth();

  const items = CUSTOMER_HUB_CHILDREN.filter(
    item => !item.perm || hasPermission(item.perm.resource, item.perm.action),
  );

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3 mb-4">
      <div className="flex items-center gap-2 mr-2">
        <Users className="h-5 w-5 text-primary" />
        <span className="font-display font-bold text-lg">Customer Overview</span>
      </div>
      {items.map(item => {
        const Icon = item.icon;
        const active = isAdminNavItemActive(location, item);
        return (
          <Link
            key={item.id}
            href={item.href}
            data-testid={`hub-nav-${item.id}`}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
