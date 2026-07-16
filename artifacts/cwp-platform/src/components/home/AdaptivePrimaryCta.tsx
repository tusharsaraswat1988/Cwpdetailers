import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { HomeAdaptiveCta } from "@/lib/home-dashboard";

interface AdaptivePrimaryCtaProps {
  cta: HomeAdaptiveCta;
}

export function AdaptivePrimaryCta({ cta }: AdaptivePrimaryCtaProps) {
  return (
    <Link href={cta.href} className="block w-full">
      <Button
        className="w-full h-11 font-semibold shadow-sm"
        data-testid={cta.testId}
      >
        {cta.label}
      </Button>
    </Link>
  );
}

export default AdaptivePrimaryCta;
