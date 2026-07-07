import { useEffect, useRef, useState } from "react";
import { useSendAuthOtp, useVerifyAuthOtp } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import { formatOtpMaskedPhone } from "@/lib/phoneDisplay";
import { useOtpResendTimer } from "@/hooks/useOtpResendTimer";
import type { AuthFlowPurpose } from "@/lib/authFlowStore";
import {
  authFadeUp,
  authOtpSlotClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type OTPVerificationProps = {
  phone: string;
  maskedPhone?: string;
  purpose: AuthFlowPurpose;
  name?: string;
  onSuccess: (data: AuthResponse) => void;
  onChangeNumber: () => void;
  autoStartTimer?: boolean;
};

export function OTPVerification({
  phone,
  purpose,
  name,
  onSuccess,
  onChangeNumber,
  autoStartTimer = true,
}: OTPVerificationProps) {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
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
        onSuccess(data);
      },
      onError: (err: unknown) => {
        submittingRef.current = false;
        const message = getAuthErrorMessage(err, "OTP expired or incorrect. Try again or tap Resend OTP.");
        setInlineError(message);
        toast({ title: "Couldn't verify OTP", description: message, variant: "destructive" });
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
        toast({
          title: "OTP sent",
          description: data.maskedPhone ? `Sent to ${formatOtpMaskedPhone(phone)}` : "Check your phone for the new code.",
        });
      },
      onError: (err: unknown) => {
        toast({
          title: "Couldn't resend OTP",
          description: getAuthErrorMessage(err, "Please try again in a moment."),
          variant: "destructive",
        });
      },
    },
  });

  const pending = verifyMutation.isPending || resendMutation.isPending;
  const displayPhone = formatOtpMaskedPhone(phone);

  const submitOtp = (code: string) => {
    if (code.length !== 6 || pending || submittingRef.current) return;
    submittingRef.current = true;
    setInlineError(null);
    verifyMutation.mutate({
      data: {
        phone,
        code,
        purpose,
        ...(purpose === "signup" ? { name: name?.trim() } : {}),
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
    if (inlineError) setInlineError(null);
    if (digits.length === 6) submitOtp(digits);
  };

  const handleResend = () => {
    if (!canResend || pending) return;
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
        <h2 className="font-display font-semibold text-xl text-white" id="otp-heading">
          Verify your mobile number
        </h2>
        <p className="text-white/55 text-sm tabular-nums tracking-wide" id="otp-description">
          {displayPhone}
        </p>
        <p className="text-white/30 text-xs leading-relaxed max-w-[16rem] mx-auto">
          We&apos;ll send a one-time verification code to your mobile number.
          <br />
          No spam. No promotional messages.
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
                <InputOTPSlot key={i} index={i} className={authOtpSlotClass} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {inlineError ? (
          <p id="otp-error" className="text-center text-destructive text-sm" role="alert">
            {inlineError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending || otp.length !== 6}
          className={authPrimaryButtonClass}
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
        </Button>
      </form>

      <div className={cn("flex flex-col items-center gap-1.5 text-sm pb-safe", authFadeUp, "delay-200")}>
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={pending}
            className="text-primary hover:underline font-medium disabled:opacity-50 min-h-[44px] px-4 transition-opacity duration-200"
            data-testid="btn-resend-otp"
          >
            {resendMutation.isPending ? "Sending..." : "Resend OTP"}
          </button>
        ) : (
          <p className="text-white/35 tabular-nums min-h-[44px] flex items-center text-xs" aria-live="polite">
            Resend in {secondsLeft}s
          </p>
        )}

        <button
          type="button"
          onClick={onChangeNumber}
          disabled={pending}
          className="text-white/35 hover:text-white/55 transition-colors duration-200 disabled:opacity-50 min-h-[44px] px-4 text-xs"
          data-testid="btn-change-number"
        >
          Change mobile number
        </button>
      </div>
    </div>
  );
}
