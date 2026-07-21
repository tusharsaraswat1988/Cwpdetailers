import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useSendAuthOtp } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
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
import { PasswordLogin } from "@/components/auth/PasswordLogin";
import { AuthOtpOverlay } from "@/components/auth/AuthOtpOverlay";
import { AuthGoogleDialogs } from "@/components/auth/AuthGoogleDialogs";
import {
  authFadeUp,
  authFormStagger,
  authGoogleButtonClass,
  authLinkClass,
  authMutedLinkClass,
  authPhoneInputClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { AlertCircle, ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function usePhoneFromQuery() {
  const [location] = useLocation();
  const queryStart = location.indexOf("?");
  if (queryStart === -1) return "";
  return new URLSearchParams(location.slice(queryStart + 1)).get("phone") ?? "";
}

export default function Login() {
  const branding = useBranding();
  const { toast } = useToast();
  const queryPhone = usePhoneFromQuery();

  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showOtpLogin, setShowOtpLogin] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const { otpSession, showOtp, setOtpSession, clearOtpSession } = useAuthFlowStore();

  const {
    googlePending,
    phoneLink,
    clearPhoneLink,
    handleGoogleToken,
    handleAuthSuccess,
    googleDisabled,
    authError,
    clearAuthError,
  } = useAuthFlow("customer");

  const phoneReady = useMemo(() => isValidIndianMobileDigits(phone), [phone]);

  useEffect(() => {
    if (queryPhone) setPhone(queryPhone.replace(/\D/g, "").slice(0, 10));
  }, [queryPhone]);

  const sendOtpMutation = useSendAuthOtp({
    mutation: {
      onSuccess: (data, variables) => {
        setOtpError(null);
        trackAuthEvent("otp_sent", { method: "otp", portal: "customer" });
        setOtpSession({
          purpose: "login",
          phone: variables.data.phone,
          maskedPhone: data.maskedPhone,
        });
      },
      onError: (err: unknown) => {
        const message = getAuthErrorMessage(err);
        setOtpError(message);
        toast({ title: "Verification required", description: message, variant: "destructive" });
      },
    },
  });

  const handleOtpContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    if (authError) clearAuthError();

    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }

    sendOtpMutation.mutate({ data: { phone: phoneResult.value, purpose: "login" } });
  };

  const handlePasswordSuccess = useCallback(
    (data: Parameters<typeof handleAuthSuccess>[0]) => {
      trackAuthEvent("password_login", { method: "password", portal: "customer" });
      trackAuthEvent("login_completed", { method: "password", portal: "customer" });
      handleAuthSuccess(data);
    },
    [handleAuthSuccess],
  );

  const handleOtpSuccess = useCallback(
    (data: Parameters<typeof handleAuthSuccess>[0]) => {
      trackAuthEvent("otp_verified", { method: "otp", portal: "customer" });
      trackAuthEvent("login_completed", { method: "otp", portal: "customer" });
      clearOtpSession();
      handleAuthSuccess(data);
    },
    [clearOtpSession, handleAuthSuccess],
  );

  const pending = sendOtpMutation.isPending || googlePending;

  return (
    <AuthLayout testId="login-page">
      <AuthHeader
        title="Welcome back"
        subtitle="Sign in with your password — OTP only if you need it"
      />

      {authError && (
        <div
          className={cn("rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 flex items-start gap-2 mb-3", authFadeUp)}
          role="alert"
          data-testid="login-auth-error"
        >
          <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" aria-hidden />
          <p className="text-destructive text-sm leading-snug">{authError}</p>
        </div>
      )}

      <div className={cn("space-y-3", authFormStagger, authFadeUp, "delay-150")}>
        <PhoneInput
          id="login-phone"
          data-testid="input-phone"
          label="Mobile number"
          dark
          indianMobile
          hideHint
          deferValidationUntilComplete
          value={phone}
          onChange={next => {
            setPhone(next);
            if (authError) clearAuthError();
          }}
          error={phoneError}
          onErrorChange={setPhoneError}
          autoComplete="tel"
          className={authPhoneInputClass}
        />

        <PasswordLogin
          phone={phone}
          onSuccess={handlePasswordSuccess}
          disabled={googlePending}
        />
      </div>

      <AuthDivider className="my-3.5" />

      <div className={cn(authFadeUp, "delay-200")}>
        <GoogleButton
          onSuccess={idToken => {
            trackAuthEvent("google_started", { method: "google", portal: "customer" });
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
          <p
            className="text-center text-white/35 text-xs flex items-center justify-center gap-1.5 mt-1.5"
            aria-live="polite"
          >
            <Loader2 size={12} className="animate-spin" aria-hidden />
            Signing in with Google...
          </p>
        )}
      </div>

      <AuthDivider className="my-3.5" />

      <div className={cn(authFadeUp, "delay-300")}>
        <button
          type="button"
          onClick={() => setShowOtpLogin(v => !v)}
          className="w-full flex items-center justify-center gap-2 text-white/40 hover:text-white/65 text-sm font-normal py-1.5 min-h-[44px] transition-colors duration-200"
          data-testid="btn-toggle-otp-login"
          aria-expanded={showOtpLogin}
          aria-controls="otp-login-panel"
        >
          {showOtpLogin ? "OTP login" : "Sign in with OTP instead"}
          <ChevronDown
            size={15}
            className={cn("transition-transform duration-300 ease-out", showOtpLogin && "rotate-180")}
            aria-hidden
          />
        </button>

        <div
          id="otp-login-panel"
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            showOtpLogin ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!showOtpLogin}
        >
          <div className="overflow-hidden">
            <form
              onSubmit={handleOtpContinue}
              className={cn(
                "pt-3 space-y-3 transition-opacity duration-300",
                showOtpLogin ? "opacity-100" : "opacity-0",
              )}
            >
              <p className="text-white/30 text-xs text-center leading-relaxed">
                Use OTP if you haven&apos;t set a password yet, or can&apos;t remember it.
              </p>
              {otpError && (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 flex items-start gap-2"
                  role="alert"
                  data-testid="login-otp-error"
                >
                  <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" aria-hidden />
                  <p className="text-destructive text-sm leading-snug">{otpError}</p>
                </div>
              )}
              <Button
                type="submit"
                disabled={pending || !phoneReady}
                className={authPrimaryButtonClass}
                data-testid="btn-continue-login-otp"
              >
                {sendOtpMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" aria-hidden />
                    Sending OTP...
                  </>
                ) : (
                  "Send OTP"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className={cn("mt-4 text-center space-y-2", authFadeUp, "delay-[400ms]")}>
        <p className="text-white/40 text-sm">
          New to {branding.brandName}?{" "}
          <Link href="/register" className={cn(authLinkClass, "inline-flex items-center gap-1")}>
            Create your account
            <ArrowRight size={14} className="opacity-50" aria-hidden />
          </Link>
        </p>
        <p className="text-white/25 text-xs">
          Field staff?{" "}
          <Link href="/staff/login" className={authMutedLinkClass}>
            Staff portal
          </Link>
        </p>
        <p className="text-white/25 text-[11px] leading-relaxed pt-1" data-testid="login-trust-line">
          Secure sign-in · Your data stays private · OTP never shared
        </p>
      </div>

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
