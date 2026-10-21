import { useEffect, useRef, useState } from "react";
import { useSendAuthOtp, useVerifyAuthOtp } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { MarketingButton } from "@/features/landing/components/marketing/MarketingButton";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { getActionableAuthDetails, getAuthErrorMessage } from "@/lib/authErrorMessages";
import { formatOtpMaskedPhone } from "@/lib/phoneDisplay";
import { useOtpResendTimer } from "@/hooks/useOtpResendTimer";
import type { AuthFlowPurpose } from "@/lib/authFlowStore";
import { authFadeUp, authLinkClass } from "@/components/auth/authStyles";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type OTPVerificationProps = {
  phone: string;
  maskedPhone?: string;
  purpose: AuthFlowPurpose;
  name?: string;
  /** Required for signup — enables password login without future SMS. */
  password?: string;
  onSuccess: (data: AuthResponse) => void;
  onChangeNumber: () => void;
  onSwitchToPassword?: () => void;
  autoStartTimer?: boolean;
};

export function OTPVerification({
  phone,
  purpose,
  name,
  password,
  onSuccess,
  onChangeNumber,
  onSwitchToPassword,
  autoStartTimer = true,
}: OTPVerificationProps) {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [recoveryStep, setRecoveryStep] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const { secondsLeft, canResend, startTimer } = useOtpResendTimer(30);

  useEffect(() => {
    if (autoStartTimer) startTimer();
  }, [autoStartTimer, startTimer]);

  const verifyMutation = useVerifyAuthOtp({
    mutation: {
      onSuccess: (data) => {
        submittingRef.current = false;
        setInlineError(null);
        setRecoveryStep(null);
        onSuccess(data);
      },
      onError: (err: unknown) => {
        submittingRef.current = false;
        const details = getActionableAuthDetails(err, "The code is invalid or expired. Request a new code if permitted.");
        setInlineError(details.message);
        setRecoveryStep(details.actionableStep ?? null);
        setOtp("");
      },
    },
  });

  const resendMutation = useSendAuthOtp({
    mutation: {
      onSuccess: (data) => {
        startTimer();
        setOtp("");
        setInlineError(null);
        setRecoveryStep(null);
        toast({
          title: "Code sent",
          description: data.maskedPhone ? `Sent to ${formatOtpMaskedPhone(phone)}` : "Check your phone for the new code.",
        });
      },
      onError: (err: unknown) => {
        const details = getActionableAuthDetails(err, "Unable to send verification code. Please try again in a few moments.");
        setInlineError(details.message);
        setRecoveryStep(details.actionableStep ?? null);
      },
    },
  });

  const pending = verifyMutation.isPending || resendMutation.isPending;
  const displayPhone = formatOtpMaskedPhone(phone);

  const submitOtp = (code: string) => {
    if (code.length !== 6 || pending || submittingRef.current) return;
    if (purpose === "signup" && (!password || password.length < 6)) {
      setInlineError("Password is missing. Go back and create a password, then request a new OTP.");
      return;
    }
    submittingRef.current = true;
    setInlineError(null);
    setRecoveryStep(null);
    verifyMutation.mutate({
      data: {
        phone,
        code,
        purpose,
        ...(purpose === "signup"
          ? {
              name: name?.trim(),
              password,
            }
          : {}),
      },
    });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    submitOtp(otp);
  };

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
    if (inlineError) {
      setInlineError(null);
      setRecoveryStep(null);
    }
    if (digits.length === 6) submitOtp(digits);
  };

  const handleResend = () => {
    if (!canResend || pending) return;
    setInlineError(null);
    setRecoveryStep(null);
    resendMutation.mutate({
      data: {
        phone,
        purpose,
        ...(purpose === "signup" && name ? { name: name.trim() } : {}),
      },
    });
  };

  return (
    <div className="space-y-5" data-testid="otp-verification">
      <div className={cn("text-center space-y-2.5", authFadeUp)}>
        <h2 className="font-display font-semibold text-xl text-foreground" id="otp-heading">
          Verify your mobile number
        </h2>
        <p className="text-muted-foreground text-sm tabular-nums tracking-wide font-medium" id="otp-description">
          {displayPhone}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed max-w-[16rem] mx-auto">
          {purpose === "signup"
            ? "Enter the 6-digit code to complete account verification."
            : "Enter the 6-digit code sent to your phone."}
        </p>
      </div>

      <form onSubmit={handleVerify} className={cn("space-y-4", authFadeUp, "delay-100")}>
        <div
          className="flex justify-center px-1"
          role="group"
          aria-labelledby="otp-heading"
          aria-describedby={inlineError ? "otp-error" : "otp-description"}
        >
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={handleOtpChange}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            disabled={pending}
            data-testid="input-otp"
          >
            <InputOTPGroup className="gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-14 w-11 sm:w-12 rounded-xl border-border bg-background text-foreground text-lg sm:text-xl first:rounded-xl last:rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {inlineError ? (
          <div
            id="otp-error"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-center text-destructive text-sm flex flex-col items-center gap-1.5"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center gap-1.5 font-medium">
              <AlertCircle size={15} className="shrink-0" aria-hidden />
              <span>{inlineError}</span>
            </div>
            {recoveryStep ? (
              <p className="text-xs text-destructive/90 leading-tight">
                {recoveryStep}
              </p>
            ) : null}
            {onSwitchToPassword ? (
              <button
                type="button"
                onClick={onSwitchToPassword}
                className="mt-1 text-xs text-foreground underline hover:text-foreground/80 font-medium"
              >
                Sign in with password instead
              </button>
            ) : null}
          </div>
        ) : null}

        <MarketingButton
          type="submit"
          size="lg"
          disabled={pending || otp.length !== 6}
          className="w-full"
          data-testid="btn-verify-otp"
        >
          {verifyMutation.isPending ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" aria-hidden />
              Verifying...
            </>
          ) : (
            "Continue"
          )}
        </MarketingButton>
      </form>

      <div className={cn("flex flex-col items-center gap-1.5 text-sm pb-safe", authFadeUp, "delay-200")}>
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={pending}
            className={cn(authLinkClass, "disabled:opacity-50 min-h-[44px] px-4 font-medium")}
            data-testid="btn-resend-otp"
          >
            {resendMutation.isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                Sending new code...
              </span>
            ) : (
              "Resend OTP"
            )}
          </button>
        ) : (
          <p className="text-muted-foreground tabular-nums min-h-[44px] flex items-center text-xs" aria-live="polite">
            Resend code in {secondsLeft}s
          </p>
        )}

        <button
          type="button"
          onClick={onChangeNumber}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground transition-colors duration-200 disabled:opacity-50 min-h-[44px] px-4 text-xs font-normal"
          data-testid="btn-change-number"
        >
          Edit mobile number
        </button>
      </div>
    </div>
  );
}
