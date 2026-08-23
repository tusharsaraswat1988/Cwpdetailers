import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useSendAuthOtp } from "@workspace/api-client-react";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { PasswordLogin } from "@/components/auth/PasswordLogin";
import { AuthOtpOverlay } from "@/components/auth/AuthOtpOverlay";
import { AuthGoogleDialogs } from "@/components/auth/AuthGoogleDialogs";
import {
  authControlClass,
  authFadeUp,
  authFormStagger,
  authLandingRingClass,
  authLinkClass,
  authMutedLinkClass,
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

  const [authStep, setAuthStep] = useState<"chooser" | "credentials">("chooser");
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
    if (queryPhone) {
      setPhone(queryPhone.replace(/\D/g, "").slice(0, 10));
      setAuthStep("credentials");
    }
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
        subtitle={
          authStep === "chooser"
            ? "Continue with Google, or sign in with your mobile number"
            : "Sign in with your password — OTP only if you need it"
        }
      />

      <AuthPanel>
      {authError && (
        <div
          className={cn("rounded-[var(--customer-radius-sm,0.75rem)] border border-destructive/30 bg-destructive/10 px-3 py-2.5 flex items-start gap-2 mb-3", authFadeUp)}
          role="alert"
          data-testid="login-auth-error"
        >
          <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" aria-hidden />
          <p className="text-destructive text-sm leading-snug">{authError}</p>
        </div>
      )}

      <div className={authStep === "chooser" ? undefined : "hidden"} aria-hidden={authStep !== "chooser"}>
        <AuthMethodChooser
          onGoogleSuccess={idToken => {
            trackAuthEvent("google_started", { method: "google", portal: "customer" });
            handleGoogleToken(idToken);
          }}
          onGoogleError={msg => {
            trackAuthEvent("google_cancelled", { method: "google", portal: "customer" });
            toast({ title: "Google sign-in", description: getAuthErrorMessage(msg), variant: "destructive" });
          }}
          googleDisabled={googleDisabled}
          googlePending={googlePending}
          googlePendingLabel="Signing in with Google..."
          secondaryLabel="Login with mobile"
          secondaryTestId="btn-login-email"
          onChooseSecondary={() => setAuthStep("credentials")}
        />
      </div>

      {authStep === "credentials" ? (
        <div data-testid="login-credential-form">
          <AuthBackButton onClick={() => setAuthStep("chooser")} disabled={pending} />

          <div className={cn("space-y-3", authFormStagger, authFadeUp, "delay-150")}>
            <PhoneInput
              id="login-phone"
              data-testid="input-phone"
              label="Mobile number"
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
              className={cn(authControlClass, authLandingRingClass)}
            />

            <PasswordLogin
              phone={phone}
              onSuccess={handlePasswordSuccess}
              disabled={googlePending}
            />
          </div>

          <div className={cn("mt-1", authFadeUp, "delay-300")}>
            <button
              type="button"
              onClick={() => setShowOtpLogin(v => !v)}
              className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground text-sm font-normal py-1.5 min-h-[44px] transition-colors duration-200"
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
                  <p className="text-muted-foreground text-xs text-center leading-relaxed">
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
                  <MarketingButton
                    type="submit"
                    size="lg"
                    disabled={pending || !phoneReady}
                    className="w-full"
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
                  </MarketingButton>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </AuthPanel>

      <div className={cn("mt-5 text-center space-y-2", authFadeUp, "delay-[400ms]")}>
        <p className="text-sm text-muted-foreground">
          New to {branding.brandName}?{" "}
          <Link href="/register" className={cn(authLinkClass, "inline-flex items-center gap-1")}>
            Create your account
            <ArrowRight size={14} className="opacity-50" aria-hidden />
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          Field staff?{" "}
          <Link href="/staff/login" className={authMutedLinkClass}>
            Staff portal
          </Link>
        </p>
        <p className="text-[11px] leading-relaxed pt-1 text-muted-foreground" data-testid="login-trust-line">
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
