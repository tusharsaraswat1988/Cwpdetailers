import { AlertCircle } from "lucide-react";
import {
  MarketingPageShell,
  MarketingSection,
  MarketingHeading,
  MarketingCard,
  MarketingButton,
} from "@/features/landing/components/marketing";

export default function NotFound() {
  return (
    <MarketingPageShell>
      <MarketingSection className="flex min-h-[60vh] items-center justify-center">
        <MarketingCard className="w-full max-w-md">
          <div className="mb-4 flex items-start gap-3">
            <div className="marketing-icon-well flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <AlertCircle className="h-5 w-5" aria-hidden />
            </div>
            <MarketingHeading title="Page not found" as="h1" className="text-left" />
          </div>
          <p className="text-sm text-muted-foreground">
            This page doesn’t exist or may have moved. Head back to the homepage to continue.
          </p>
          <MarketingButton href="/" variant="primary" className="mt-6">
            Back to Home
          </MarketingButton>
        </MarketingCard>
      </MarketingSection>
    </MarketingPageShell>
  );
}
