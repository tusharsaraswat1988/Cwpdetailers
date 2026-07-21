import { memo } from "react";
import { Link } from "wouter";
import { Phone } from "lucide-react";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import type { SupervisorContactInfo } from "@/components/shared/SupervisorContactCard";
import { AccountSection, AccountTextAction } from "./AccountSection";

type Props = {
  supervisor?: SupervisorContactInfo | null;
};

const rowClass =
  "flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-left customer-transition hover:bg-foreground/[0.03] active:bg-foreground/[0.05]";

export const SupportSection = memo(function SupportSection({ supervisor }: Props) {
  return (
    <AccountSection title="Help & Support" testId="account-support-section">
      <Link href={CUSTOMER_ROUTES.support} className={rowClass} data-testid="account-support-complaint">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">Raise Complaint</p>
        <AccountTextAction>→</AccountTextAction>
      </Link>

      <Link href={CUSTOMER_ROUTES.support} className={rowClass} data-testid="account-support-contact">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">Contact Support</p>
        <AccountTextAction>→</AccountTextAction>
      </Link>

      <a href="/#faq" className={rowClass} data-testid="account-support-faq">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">FAQ</p>
        <AccountTextAction>→</AccountTextAction>
      </a>

      {supervisor ? (
        <div
          className="flex min-h-11 items-center gap-3 px-4 py-2.5"
          data-testid="account-assigned-supervisor"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Assigned Supervisor</p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{supervisor.name}</p>
          </div>
          <a
            href={`tel:${supervisor.phone}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[var(--customer-radius-sm,0.75rem)] px-2 text-sm font-medium text-primary customer-transition hover:bg-primary/5"
            data-testid="btn-call-supervisor"
          >
            <Phone size={14} aria-hidden />
            Call
          </a>
        </div>
      ) : null}
    </AccountSection>
  );
});
