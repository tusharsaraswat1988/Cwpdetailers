import { Link } from "wouter";
import {
  ClipboardList,
  Car,
  Calendar,
  Receipt,
  History,
  MapPin,
  Headphones,
  ChevronRight,
} from "lucide-react";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { cn } from "@/lib/utils";

interface QuickActionsGridProps {
  onOpenAddressManager?: () => void;
  className?: string;
}

export function QuickActionsGrid({ onOpenAddressManager, className }: QuickActionsGridProps) {
  const actions = [
    {
      label: "My Plans",
      description: "Subscriptions & usage",
      icon: ClipboardList,
      href: CUSTOMER_ROUTES.plans,
      testId: "qa-my-plans",
    },
    {
      label: "My Vehicles",
      description: "Cars & solar sites",
      icon: Car,
      href: CUSTOMER_ROUTES.assets,
      testId: "qa-my-vehicles",
    },
    {
      label: "Schedule",
      description: "Book next visit",
      icon: Calendar,
      href: CUSTOMER_ROUTES.scheduleEntry({ from: "home" }),
      testId: "qa-schedule",
    },
    {
      label: "Billing & Invoices",
      description: "Receipts & payments",
      icon: Receipt,
      href: CUSTOMER_ROUTES.invoices,
      testId: "qa-billing",
    },
    {
      label: "Service History",
      description: "Past cleaning records",
      icon: History,
      href: CUSTOMER_ROUTES.serviceHistory,
      testId: "qa-history",
    },
    {
      label: "Manage Addresses",
      description: "Saved service locations",
      icon: MapPin,
      href: onOpenAddressManager ? undefined : CUSTOMER_ROUTES.account,
      onClick: onOpenAddressManager,
      testId: "qa-addresses",
    },
    {
      label: "Customer Support",
      description: "Supervisor & helpline",
      icon: Headphones,
      href: CUSTOMER_ROUTES.support,
      testId: "qa-support",
    },
  ];

  return (
    <section className={cn("space-y-3", className)} aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="font-display font-bold text-base text-foreground">
        Quick Actions
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {actions.map(action => {
          const Icon = action.icon;
          const inner = (
            <div className="flex items-center gap-3 p-3.5 sm:p-4 min-h-[58px] rounded-2xl border border-slate-200/90 bg-white hover:border-primary/40 shadow-[0_2px_8px_rgba(11,29,54,0.04)] hover:shadow-[0_4px_14px_rgba(11,29,54,0.08)] active:scale-[0.985] transition-all duration-200 h-full text-left cursor-pointer">
              <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center shrink-0 border border-slate-100">
                <Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs sm:text-sm text-foreground truncate leading-tight">
                  {action.label}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {action.description}
                </p>
              </div>
              <ChevronRight size={14} className="text-slate-400 shrink-0 hidden sm:block" />
            </div>
          );

          if (action.onClick) {
            return (
              <button
                key={action.testId}
                type="button"
                onClick={action.onClick}
                className="w-full text-left"
                data-testid={action.testId}
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={action.testId}
              href={action.href!}
              className="block"
              data-testid={action.testId}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default QuickActionsGrid;
