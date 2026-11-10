import { memo } from "react";
import { Link } from "wouter";
import { Phone, Headphones } from "lucide-react";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { useBranding } from "@/lib/branding";
import type { SupervisorContactInfo } from "@/components/shared/SupervisorContactCard";
import { AccountSection, AccountTextAction } from "./AccountSection";

type Props = {
  supervisor?: SupervisorContactInfo | null;
};

const rowClass =
  "flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-left customer-transition hover:bg-foreground/[0.03] active:bg-foreground/[0.05]";

export const SupportSection = memo(function SupportSection({ supervisor }: Props) {
  const branding = useBranding();
  const phone = supervisor?.phone || branding.supportPhone || "7054007733";

  return (
    <AccountSection title="Help & Support" testId="account-support-section">
      {/* Click-to-call single button */}
      <div className="p-3 mx-4 my-1.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Headphones size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">Customer Support</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {supervisor?.name ? `Supervisor: ${supervisor.name}` : "Instant phone support"}
            </p>
          </div>
        </div>

        <a
          href={`tel:${phone}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-[#1264db] text-white text-xs font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
          data-testid="btn-call-support"
          aria-label={`Call Support ${phone}`}
        >
          <Phone size={12} />
          Call Support
        </a>
      </div>

      <Link href={CUSTOMER_ROUTES.support} className={rowClass} data-testid="account-support-complaint">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">Raise Complaint</p>
        <AccountTextAction>→</AccountTextAction>
      </Link>

      <a href="/#faq" className={rowClass} data-testid="account-support-faq">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">FAQ & Knowledgebase</p>
        <AccountTextAction>→</AccountTextAction>
      </a>
    </AccountSection>
  );
});
