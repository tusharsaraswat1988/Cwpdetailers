import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useSendAuthOtp } from "@workspace/api-client-react";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Input } from "@/components/ui/input";
import { MarketingButton } from "@/features/landing/components/marketing/MarketingButton";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import { isValidIndianMobileDigits } from "@/lib/phoneDisplay";
import { trackAuthEvent } from "@/lib/authAnalytics";
import { useBranding } from "@/lib/branding";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useAuthFlowStore } from "@/lib/authFlowStore";
import { AuthLayout, AuthPanel } from "@/components/auth/AuthLayout";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFooter } from "@/components/auth/AuthFooter";
import { AuthBackButton } from "@/components/auth/AuthBackButton";
import { AuthMethodChooser } from "@/components/auth/AuthMethodChooser";
import { AuthOtpOverlay } from "@/components/auth/AuthOtpOverlay";
import { AuthGoogleDialogs } from "@/components/auth/AuthGoogleDialogs";
import {
  CreatePasswordFields,
  validateCreatePassword,
} from "@/components/auth/CreatePasswordFields";
import {
  authControlClass,
  authFadeUp,
  authFormStagger,
  authLandingRingClass,
  authLinkClass,
} from "@/components/auth/authStyles";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function usePhoneFromQuery() {
  const [location] = useLocation();
  const queryStart = location.indexOf("?");
  if (queryStart === -1) return "";
  return new URLSearchParams(location.slice(queryStart + 1)).get("phone") ?? "";
}

export default function Register() {
  const branding = useBranding();
  const { toast } = useToast();
  const queryPhone = usePhoneFromQuery();

  const [authStep, setAuthStep] = useState<"chooser" | "credentials">("chooser");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const phoneReady = useMemo(() => isValidIndianMobileDigits(phone), [phone]);
  const nameReady = name.trim().length > 0;
  const passwordReady = validateCreatePassword(password, confirmPassword).ok;
  const formReady = phoneReady && nameReady && passwordReady;

  const { otpSession, showOtp, setOtpSession, clearOtpSession } = useAuthFlowStore();

  const {
    googlePending,
    phoneLink,
    clearPhoneLink,
    handleGoogleToken,
    handleAuthSuccess,
    googleDisabled,
  } = useAuthFlow("customer");

  useEffect(() => {
    if (queryPhone) {
      setPhone(queryPhone.replace(/\D/g, "").slice(0, 10));
      setAuthStep("credentials");
    }
  }, [queryPhone]);

  const sendOtpMutation = useSendAuthOtp({
    mutation: {
      onSuccess: (data, variables) => {
        trackAuthEvent("otp_sent", { method: "otp", portal: "customer" });
        setOtpSession({
          purpose: "signup",
          phone: variables.data.phone,
          maskedPhone: data.maskedPhone,
          name: variables.data.name?.trim() ?? name.trim(),
          password,
        });
      },
      onError: (err: unknown) => {
        toast({
          title: "Unable to continue",
          description: getAuthErrorMessage(err),
          variant: "destructive",
        });
      },
    },
  });

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    trackAuthEvent("registration_started", { method: "otp", portal: "customer" });

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Please enter your full name", variant: "destructive" });
      return;
    }

    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }

    const pwResult = validateCreatePassword(password, confirmPassword);
    if (!pwResult.ok) {
      toast({ title: pwResult.error, variant: "destructive" });
      return;
    }

    sendOtpMutation.mutate({
      data: {
        phone: phoneResult.value,
        purpose: "signup",
        name: trimmedName,
      },
    });
  };

  const handleOtpSuccess = useCallback(
    (data: Parameters<typeof handleAuthSuccess>[0]) => {
      trackAuthEvent("otp_verified", { method: "otp", portal: "customer" });
      trackAuthEvent("registration_completed", { method: "otp", portal: "customer" });
      clearOtpSession();
      handleAuthSuccess(data);
    },
    [clearOtpSession, handleAuthSuccess],
  );

  const pending = sendOtpMutation.isPending || googlePending;

  return (
    <AuthLayout testId="register-page">
      <AuthHeader
        title="Create your account"
        subtitle={
          authStep === "chooser"
            ? "Continue with Google, or sign up with your mobile number"
            : `Join the ${branding.brandName} community`
        }
      />

      <AuthPanel>
      <div className={authStep === "chooser" ? undefined : "hidden"} aria-hidden={authStep !== "chooser"}>
        <AuthMethodChooser
          onGoogleSuccess={idToken => {
            trackAuthEvent("google_started", { method: "google", portal: "customer" });
            trackAuthEvent("registration_started", { method: "google", portal: "customer" });
            handleGoogleToken(idToken);
          }}
          onGoogleError={msg => {
            trackAuthEvent("google_cancelled", { method: "google", portal: "customer" });
            toast({ title: "Google sign-in", description: getAuthErrorMessage(msg), variant: "destructive" });
          }}
          googleDisabled={googleDisabled}
          googlePending={googlePending}
          googlePendingLabel="Signing up with Google..."
          secondaryLabel="Sign up with mobile"
          secondaryTestId="btn-signup-email"
          onChooseSecondary={() => setAuthStep("credentials")}
        />
      </div>

      {authStep === "credentials" ? (
        <div data-testid="register-credential-form">
          <AuthBackButton onClick={() => setAuthStep("chooser")} disabled={pending} />

          <form
            onSubmit={handleContinue}
            className={cn("space-y-3", authFormStagger, authFadeUp, "delay-150")}
          >
            <div>
              <Label htmlFor="register-name" className="text-sm text-muted-foreground">
                Full name
              </Label>
              <Input
                id="register-name"
                data-testid="input-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                className={cn("mt-1.5", authControlClass, authLandingRingClass)}
              />
            </div>

            <PhoneInput
              id="register-phone"
              data-testid="input-phone"
              label="Mobile number"
              indianMobile
              hideHint
              deferValidationUntilComplete
              value={phone}
              onChange={setPhone}
              error={phoneError}
              onErrorChange={setPhoneError}
              autoComplete="tel"
              className={cn(authControlClass, authLandingRingClass)}
            />

            <CreatePasswordFields
              idPrefix="register"
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirmPassword}
              disabled={pending}
            />

            <MarketingButton
              type="submit"
              size="lg"
              disabled={pending || !formReady}
              className="w-full"
              data-testid="btn-continue-register"
            >
              {sendOtpMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" aria-hidden />
                  Sending OTP...
                </>
              ) : (
                "Continue"
              )}
            </MarketingButton>

            <p className="text-center text-muted-foreground text-[11px] leading-relaxed">
              We&apos;ll send a one-time OTP to verify your number. After that, sign in with your password — no SMS needed.
            </p>
          </form>
        </div>
      ) : null}
      </AuthPanel>

      <p className={cn("mt-4 text-center text-muted-foreground text-[11px] leading-relaxed px-2", authFadeUp, "delay-300")}>
        By continuing, you agree to our{" "}
        <Link href="/terms-and-conditions" className={cn(authLinkClass, "text-[11px]")}>
          Terms
        </Link>
        {" "}and{" "}
        <Link href="/privacy-policy" className={cn(authLinkClass, "text-[11px]")}>
          Privacy Policy
        </Link>
        .
      </p>

      <p className={cn("mt-3 text-center text-sm text-muted-foreground", authFadeUp, "delay-[400ms]")}>
        Already have an account?{" "}
        <Link href="/login" className={cn(authLinkClass, "inline-flex items-center gap-1")}>
          Sign in
          <ArrowRight size={14} className="opacity-50" aria-hidden />
        </Link>
      </p>

      <AuthFooter />

      {otpSession && (
        <AuthOtpOverlay open={showOtp} session={otpSession} onSuccess={handleOtpSuccess} onClose={clearOtpSession} />
      )}

      <AuthGoogleDialogs
        phoneLink={phoneLink}
        onPhoneLinkSuccess={data => {
          trackAuthEvent("google_success", { method: "google", portal: "customer" });
          trackAuthEvent("registration_completed", { method: "google", portal: "customer" });
          clearPhoneLink();
          handleAuthSuccess(data);
        }}
        onPhoneLinkClose={clearPhoneLink}
      />
    </AuthLayout>
  );
}
