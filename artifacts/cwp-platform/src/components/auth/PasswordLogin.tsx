import { useState } from "react";
import { Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { submitMobile } from "@/lib/contactForm";
import { getActionableAuthDetails } from "@/lib/authErrorMessages";
import { isValidIndianMobileDigits } from "@/lib/phoneDisplay";
import type { AuthPortal } from "@/lib/authFlowStore";
import { MarketingButton } from "@/features/landing/components/marketing/MarketingButton";
import { authControlClass, authLinkClass } from "@/components/auth/authStyles";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordLoginProps = {
  phone: string;
  portal?: AuthPortal;
  onSuccess: (data: AuthResponse) => void;
  disabled?: boolean;
  className?: string;
};

export function PasswordLogin({
  phone,
  portal = "customer",
  onSuccess,
  disabled,
  className,
}: PasswordLoginProps) {
  const [password, setPassword] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionableDetails, setActionableDetails] = useState<{
    actionableStep?: string;
    actionUrl?: string;
    actionLabel?: string;
  } | null>(null);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data: AuthResponse) => {
        setFormError(null);
        setActionableDetails(null);
        onSuccess(data);
      },
      onError: (err: unknown) => {
        const details = getActionableAuthDetails(err, "Incorrect mobile number or password.");
        setFormError(details.message);
        setActionableDetails(details);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMutation.isPending || disabled) return;
    setFormError(null);
    setActionableDetails(null);

    const phoneResult = submitMobile(phone);
    if (!phoneResult.ok) {
      setFormError("Enter a valid 10-digit mobile number above, then sign in with your password.");
      return;
    }

    if (!password.trim()) {
      setFormError("Please enter your password.");
      return;
    }

    loginMutation.mutate({
      data: { phone: phoneResult.value, password, portal },
    });
  };

  const pending = loginMutation.isPending || disabled;
  const canSubmit = isValidIndianMobileDigits(phone) && password.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)} data-testid="password-login">
      {formError && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 flex flex-col gap-1.5"
          role="alert"
          aria-live="assertive"
          data-testid="password-login-error"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="text-destructive text-sm font-medium leading-snug">{formError}</p>
              {actionableDetails?.actionableStep && (
                <p className="text-destructive/85 text-xs">{actionableDetails.actionableStep}</p>
              )}
            </div>
          </div>
          {actionableDetails?.actionUrl && actionableDetails?.actionLabel ? (
            <div className="pl-6 pt-0.5">
              <Link
                href={actionableDetails.actionUrl}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-4 hover:opacity-80"
              >
                {actionableDetails.actionLabel}
                <ArrowRight size={12} />
              </Link>
            </div>
          ) : null}
        </div>
      )}
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password-login-password" className="text-sm text-muted-foreground">
            Password
          </Label>
          <Link
            href="/forgot-password"
            className={cn(authLinkClass, "text-xs min-h-[44px] flex items-center shrink-0")}
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password-login-password"
          data-testid="input-password"
          value={password}
          onChange={e => {
            setPassword(e.target.value);
            if (formError) {
              setFormError(null);
              setActionableDetails(null);
            }
          }}
          onKeyUp={e => setCapsLockOn(e.getModifierState("CapsLock"))}
          onBlur={() => setCapsLockOn(false)}
          placeholder="Enter your password"
          autoComplete="current-password"
          containerClassName="mt-1.5"
          className={authControlClass}
        />
        {capsLockOn ? (
          <p className="text-amber-500 text-xs mt-1.5" role="status">
            Caps Lock is on
          </p>
        ) : null}
      </div>

      <MarketingButton
        type="submit"
        size="lg"
        disabled={pending || !canSubmit}
        className="w-full"
        data-testid="btn-submit-login"
      >
        {loginMutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" aria-hidden />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </MarketingButton>
    </form>
  );
}
