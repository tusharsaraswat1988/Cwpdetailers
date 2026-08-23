import { MarketingButton } from "@/features/landing/components/marketing/MarketingButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { authFadeUp } from "@/components/auth/authStyles";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthMethodChooserProps = {
  onGoogleSuccess: (idToken: string) => void;
  onGoogleError: (message: string) => void;
  googleDisabled?: boolean;
  googlePending?: boolean;
  googlePendingLabel: string;
  secondaryLabel: string;
  secondaryTestId: string;
  onChooseSecondary: () => void;
};

export function AuthMethodChooser({
  onGoogleSuccess,
  onGoogleError,
  googleDisabled,
  googlePending,
  googlePendingLabel,
  secondaryLabel,
  secondaryTestId,
  onChooseSecondary,
}: AuthMethodChooserProps) {
  return (
    <div className={cn(authFadeUp)} data-testid="auth-method-chooser">
      <GoogleButton
        prominent
        onSuccess={onGoogleSuccess}
        onError={onGoogleError}
        disabled={googleDisabled || googlePending}
      />

      {googlePending && (
        <p
          className="text-center text-muted-foreground text-xs flex items-center justify-center gap-1.5 mt-2"
          aria-live="polite"
        >
          <Loader2 size={12} className="animate-spin" aria-hidden />
          {googlePendingLabel}
        </p>
      )}

      <AuthDivider label="OR" />

      <MarketingButton
        type="button"
        variant="outline"
        size="lg"
        onClick={onChooseSecondary}
        disabled={googlePending}
        data-testid={secondaryTestId}
        className="w-full"
      >
        {secondaryLabel}
      </MarketingButton>
    </div>
  );
}
