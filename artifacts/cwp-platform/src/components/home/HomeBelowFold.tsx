import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import type { HomeActionItem } from "@/lib/home-dashboard";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { CustomerActionCard } from "@/features/customer-ds";

interface HomeBelowFoldProps {
  actionQueue: HomeActionItem[];
}

export function HomeBelowFold({ actionQueue }: HomeBelowFoldProps) {
  return (
    <div className="space-y-3 pt-1" data-testid="home-below-fold">
      {actionQueue.length > 0 && (
        <div className="space-y-2" data-testid="home-action-queue">
          {actionQueue.map(item => (
            <CustomerActionCard
              key={item.testId}
              href={item.href}
              title={item.label}
              trailing={<ChevronRight size={16} className="text-muted-foreground" aria-hidden />}
            />
          ))}
        </div>
      )}

      <nav
        className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2"
        aria-label="More options"
        data-testid="home-footer-links"
      >
        <Link href={CUSTOMER_ROUTES.plans} className="customer-transition hover:text-primary min-h-9 inline-flex items-center">
          All plans
        </Link>
        <span aria-hidden>·</span>
        <Link href={CUSTOMER_ROUTES.serviceHistory} className="customer-transition hover:text-primary min-h-9 inline-flex items-center">
          Service history
        </Link>
        <span aria-hidden>·</span>
        <Link href={CUSTOMER_ROUTES.assets} className="customer-transition hover:text-primary min-h-9 inline-flex items-center">
          Assets
        </Link>
      </nav>
    </div>
  );
}

export default HomeBelowFold;
