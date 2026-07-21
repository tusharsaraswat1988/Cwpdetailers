import { Link } from "wouter";
import type { HomeAdaptiveCta } from "@/lib/home-dashboard";
import { CustomerButton } from "@/features/customer-ds";

interface AdaptivePrimaryCtaProps {
  cta: HomeAdaptiveCta;
}

export function AdaptivePrimaryCta({ cta }: AdaptivePrimaryCtaProps) {
  return (
    <CustomerButton
      href={cta.href}
      className="w-full shadow-sm"
      data-testid={cta.testId}
    >
      {cta.label}
    </CustomerButton>
  );
}

export default AdaptivePrimaryCta;
