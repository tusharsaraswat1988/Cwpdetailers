import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useForgotPassword,
  useResetPassword,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { EmailInput } from "@/components/ui/email-input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { useBranding } from "@/lib/branding";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import { trackAuthEvent } from "@/lib/authAnalytics";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFooter } from "@/components/auth/AuthFooter";
import {
  authFadeUp,
  authFormStagger,
  authInputClass,
  authLabelClass,
  authMutedLinkClass,
  authOtpSlotClass,
  authPhoneInputClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { ArrowLeft, Loader2, Mail, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthPortal = "customer" | "staff";
type Step = "request" | "verify" | "done";

type ForgotPasswordPageProps = {
  portal?: AuthPortal;
};

export default function ForgotPasswordPage({ portal: portalProp }: ForgotPasswordPageProps) {
  const branding = useBranding();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const portal: AuthPortal = portalProp
    ?? (location.startsWith("/staff") ? "staff" : "customer");

  const loginPath = portal === "staff" ? "/staff/login" : "/login";
  const title = portal === "staff" ? `${branding.brandName} staff` : "Reset password";

  const [step, setStep] = useState<Step>("request");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState<{
    sentSms?: boolean;
    sentEmail?: boolean;
    maskedPhone?: string;
    maskedEmail?: string | null;
  }>({});

  const stepSubtitle =
    step === "request"
      ? "We'll send an OTP via SMS or email"
      : step === "verify"
        ? "Enter the code and choose a new password"
        : "All set — sign in with your new password";

  const forgotMutation = useForgotPassword({
    mutation: {
      onSuccess: (data) => {
        setDeliveryInfo(data);
        setStep("verify");
        toast({
          title: "Reset code sent",
          description: buildDeliveryMessage(data),
        });
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not send code",
          description: getAuthErrorMessage(err, "Please try again or contact support."),
          variant: "destructive",
        });
      },
    },
  });

  const resetMutation = useResetPassword({
    mutation: {
      onSuccess: () => {
        setStep("done");
        trackAuthEvent("forgot_password_completed", { portal });
        toast({ title: "Password updated", description: "You can now sign in with your new password." });
      },
      onError: (err: unknown) => {
        toast({
          title: "Reset failed",
          description: getAuthErrorMessage(err, "Invalid or expired code."),
          variant: "destructive",
        });
      },
    },
  });

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    trackAuthEvent("forgot_password_started", { portal });

    if (mode === "phone") {
      const phoneResult = submitMobile(phone);
      setPhoneError(phoneResult.ok ? null : phoneResult.error);
      if (!phoneResult.ok) {
        toast({ title: phoneResult.error, variant: "destructive" });
        return;
      }
      forgotMutation.mutate({ data: { phone: phoneResult.value, portal } });
    } else {
      const emailResult = submitEmail(email);
      setEmailError(emailResult.ok ? null : emailResult.error);
      if (!emailResult.ok) {
        toast({ title: emailResult.error, variant: "destructive" });
        return;
      }
      forgotMutation.mutate({ data: { email: emailResult.value, portal } });
    }
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    if (mode === "phone") {
      const phoneResult = submitMobile(phone);
      if (!phoneResult.ok) {
        toast({ title: phoneResult.error, variant: "destructive" });
        return;
      }
      resetMutation.mutate({ data: { phone: phoneResult.value, code: otp, newPassword, portal } });
    } else {
      const emailResult = submitEmail(email);
      if (!emailResult.ok) {
        toast({ title: emailResult.error, variant: "destructive" });
        return;
      }
      resetMutation.mutate({ data: { email: emailResult.value, code: otp, newPassword, portal } });
    }
  };

  return (
    <AuthLayout testId="forgot-password-page">
      <AuthHeader title={title} subtitle={stepSubtitle} />

      {step === "request" && (
        <form onSubmit={handleRequest} className={cn("space-y-3", authFormStagger, authFadeUp, "delay-150")}>
          <div className="flex rounded-lg border border-white/10 p-0.5 bg-white/[0.04]">
            <button
              type="button"
              onClick={() => setMode("phone")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] text-sm rounded-md transition-all duration-200",
                mode === "phone"
                  ? "bg-primary text-secondary font-medium"
                  : "text-white/45 hover:text-white/65",
              )}
            >
              <Smartphone size={14} aria-hidden />
              SMS
            </button>
            <button
              type="button"
              onClick={() => setMode("email")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] text-sm rounded-md transition-all duration-200",
                mode === "email"
                  ? "bg-primary text-secondary font-medium"
                  : "text-white/45 hover:text-white/65",
              )}
            >
              <Mail size={14} aria-hidden />
              Email
            </button>
          </div>

          {mode === "phone" ? (
            <PhoneInput
              id="forgot-phone"
              label="Registered mobile number"
              dark
              indianMobile
              hideHint
              deferValidationUntilComplete
              value={phone}
              onChange={setPhone}
              error={phoneError}
              onErrorChange={setPhoneError}
              className={authPhoneInputClass}
            />
          ) : (
            <EmailInput
              id="forgot-email"
              label="Registered email address"
              dark
              value={email}
              onChange={setEmail}
              error={emailError}
              onErrorChange={setEmailError}
              className={authInputClass}
            />
          )}

          <Button
            type="submit"
            disabled={forgotMutation.isPending}
            className={authPrimaryButtonClass}
          >
            {forgotMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" aria-hidden />
                Sending code...
              </>
            ) : (
              "Send reset code"
            )}
          </Button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={handleReset} className={cn("space-y-4", authFadeUp, "delay-150")}>
          {buildDeliveryMessage(deliveryInfo) && (
            <p className="text-white/35 text-xs text-center px-2 leading-relaxed">
              {buildDeliveryMessage(deliveryInfo)}
            </p>
          )}

          <div className="space-y-2">
            <Label className={authLabelClass}>6-digit verification code</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus inputMode="numeric">
                <InputOTPGroup className="gap-2 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <InputOTPSlot key={i} index={i} className={authOtpSlotClass} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <div>
            <Label htmlFor="new-password" className={authLabelClass}>
              New password
            </Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              containerClassName="mt-1.5"
              className={authInputClass}
            />
          </div>

          <Button
            type="submit"
            disabled={resetMutation.isPending}
            className={authPrimaryButtonClass}
          >
            {resetMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" aria-hidden />
                Updating...
              </>
            ) : (
              "Reset password"
            )}
          </Button>

          <button
            type="button"
            onClick={() => setStep("request")}
            className="w-full text-white/35 text-sm hover:text-white/55 min-h-[44px] transition-colors duration-200"
          >
            Didn&apos;t receive code? Send again
          </button>
        </form>
      )}

      {step === "done" && (
        <div className={cn("text-center space-y-4", authFadeUp, "delay-150")}>
          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <span className="text-2xl text-primary" aria-hidden>✓</span>
          </div>
          <p className="text-white/50 text-sm">Your password has been updated successfully.</p>
          <Button onClick={() => setLocation(loginPath)} className={authPrimaryButtonClass}>
            Back to sign in
          </Button>
        </div>
      )}

      <div className="mt-5">
        <Link
          href={loginPath}
          className={cn(authMutedLinkClass, "inline-flex items-center gap-1.5 text-sm min-h-[44px]")}
        >
          <ArrowLeft size={14} aria-hidden />
          Back to sign in
        </Link>
      </div>

      <AuthFooter />
    </AuthLayout>
  );
}

function buildDeliveryMessage(info: {
  sentSms?: boolean;
  sentEmail?: boolean;
  maskedPhone?: string;
  maskedEmail?: string | null;
}): string {
  const parts: string[] = [];
  if (info.sentSms && info.maskedPhone) parts.push(`SMS to ${info.maskedPhone}`);
  if (info.sentEmail && info.maskedEmail) parts.push(`email to ${info.maskedEmail}`);
  if (parts.length === 0) return "";
  return `Code sent via ${parts.join(" and ")}. Valid for 15 minutes.`;
}
