import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useSendAuthOtp } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import { isValidIndianMobileDigits } from "@/lib/phoneDisplay";
import { trackAuthEvent } from "@/lib/authAnalytics";
import { useBranding } from "@/lib/branding";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useAuthFlowStore } from "@/lib/authFlowStore";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFooter } from "@/components/auth/AuthFooter";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthOtpOverlay } from "@/components/auth/AuthOtpOverlay";
import { AuthGoogleDialogs } from "@/components/auth/AuthGoogleDialogs";
import {
  authFadeUp,
  authFormStagger,
  authGoogleButtonClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPhoneInputClass,
  authPrimaryButtonClass,
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

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const phoneReady = useMemo(() => isValidIndianMobileDigits(phone), [phone]);
  const nameReady = name.trim().length > 0;
  const formReady = phoneReady && nameReady;

  const { otpSession, showOtp, setOtpSession, clearOtpSession } = useAuthFlowStore();

  const {
    googlePending,
    phoneLink,
    pendingGoogleAuth,
    clearPhoneLink,
    handleGoogleToken,
    handleAuthSuccess,
    confirmGoogleAuth,
    declineGoogleAuth,
    googleDisabled,
  } = useAuthFlow("customer");

  useEffect(() => {
    if (queryPhone) setPhone(queryPhone.replace(/\D/g, "").slice(0, 10));
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
        subtitle={`Join the ${branding.brandName} community`}
      />

      <form
        onSubmit={handleContinue}
        className={cn("space-y-3", authFormStagger, authFadeUp, "delay-150")}
      >
        <div>
          <Label htmlFor="register-name" className={authLabelClass}>
            Full name
          </Label>
          <Input
            id="register-name"
            data-testid="input-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            className={cn(authInputClass, "mt-1.5")}
          />
        </div>

        <PhoneInput
          id="register-phone"
          data-testid="input-phone"
          label="Mobile number"
          dark
          indianMobile
          hideHint
          deferValidationUntilComplete
          value={phone}
          onChange={setPhone}
          error={phoneError}
          onErrorChange={setPhoneError}
          autoComplete="tel"
          className={authPhoneInputClass}
        />

        <Button
          type="submit"
          disabled={pending || !formReady}
          className={authPrimaryButtonClass}
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
        </Button>
      </form>

      <AuthDivider className="my-3.5" />

      <div className={cn(authFadeUp, "delay-200")}>
        <GoogleButton
          onSuccess={idToken => {
            trackAuthEvent("google_started", { method: "google", portal: "customer" });
            trackAuthEvent("registration_started", { method: "google", portal: "customer" });
            handleGoogleToken(idToken);
          }}
          onError={msg => {
            trackAuthEvent("google_cancelled", { method: "google", portal: "customer" });
            toast({ title: "Google sign-in", description: getAuthErrorMessage(msg), variant: "destructive" });
          }}
          disabled={googleDisabled || pending}
          className={authGoogleButtonClass}
        />

        {googlePending && (
          <p className="text-center text-white/35 text-xs flex items-center justify-center gap-1.5 mt-1.5" aria-live="polite">
            <Loader2 size={12} className="animate-spin" aria-hidden />
            Signing up with Google...
          </p>
        )}
      </div>

      <p className={cn("mt-3.5 text-center text-white/25 text-[11px] leading-relaxed px-2", authFadeUp, "delay-300")}>
        By continuing, you agree to our{" "}
        <Link href="/terms-and-conditions" className="text-white/40 hover:text-primary transition-colors duration-200">
          Terms
        </Link>
        {" "}and{" "}
        <Link href="/privacy-policy" className="text-white/40 hover:text-primary transition-colors duration-200">
          Privacy Policy
        </Link>
        .
      </p>

      <p className={cn("mt-3 text-center text-white/40 text-sm", authFadeUp, "delay-[400ms]")}>
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
        pendingGoogleAuth={pendingGoogleAuth}
        onPhoneLinkSuccess={data => {
          trackAuthEvent("google_success", { method: "google", portal: "customer" });
          trackAuthEvent("registration_completed", { method: "google", portal: "customer" });
          clearPhoneLink();
          handleAuthSuccess(data);
        }}
        onPhoneLinkClose={clearPhoneLink}
        onConfirmGoogle={() => {
          trackAuthEvent("google_success", { method: "google", portal: "customer" });
          trackAuthEvent("login_completed", { method: "google", portal: "customer" });
          confirmGoogleAuth();
        }}
        onDeclineGoogle={declineGoogleAuth}
      />
    </AuthLayout>
  );
}
