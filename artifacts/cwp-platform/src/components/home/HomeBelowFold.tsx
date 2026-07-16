import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import type { HomeActionItem } from "@/lib/home-dashboard";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

interface HomeBelowFoldProps {
  actionQueue: HomeActionItem[];
}

export function HomeBelowFold({ actionQueue }: HomeBelowFoldProps) {
  return (
    <div className="space-y-3 pt-1" data-testid="home-below-fold">
      {actionQueue.length > 0 && (
        <div className="space-y-1.5" data-testid="home-action-queue">
          {actionQueue.map(item => (
            <Link key={item.testId} href={item.href}>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                <span>{item.label}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <nav
        className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1"
        aria-label="More options"
        data-testid="home-footer-links"
      >
        <Link href={CUSTOMER_ROUTES.plans} className="hover:text-primary transition-colors">
          All plans
        </Link>
        <span aria-hidden>·</span>
        <Link href={CUSTOMER_ROUTES.serviceHistory} className="hover:text-primary transition-colors">
          Service history
        </Link>
        <span aria-hidden>·</span>
        <Link href={CUSTOMER_ROUTES.assets} className="hover:text-primary transition-colors">
          Assets
        </Link>
      </nav>
    </div>
  );
}

export default HomeBelowFold;
