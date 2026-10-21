import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useSendAuthOtp } from "@workspace/api-client-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { MarketingButton } from "@/features/landing/components/marketing/MarketingButton";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getActionableAuthDetails } from "@/lib/authErrorMessages";
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
import { isCustomerNativeApp } from "@/lib/native/portalNative";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
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
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpRecoveryStep, setOtpRecoveryStep] = useState<string | null>(null);

  const { otpSession, showOtp, setOtpSession, clearOtpSession } = useAuthFlowStore();

  const {
    stateMachine,
    googlePending,
    phoneLink,
    clearPhoneLink,
    handleGoogleToken,
    handleAuthSuccess,
    googleDisabled,
    authError,
    actionableDetails,
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
        setOtpRecoveryStep(null);
        stateMachine.setAwaitingOtp();
        trackAuthEvent("otp_sent", { method: "otp", portal: "customer" });
        setOtpSession({
          purpose: "login",
          phone: variables.data.phone,
          maskedPhone: data.maskedPhone,
        });
      },
      onError: (err: unknown) => {
        const details = getActionableAuthDetails(err);
        setOtpError(details.message);
        setOtpRecoveryStep(details.actionableStep ?? null);
        stateMachine.failWithError(err);
      },
    },
  });

  const handleOtpContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendOtpMutation.isPending || !stateMachine.canSubmit) return; // Prevent double clicks

    setOtpError(null);
    setOtpRecoveryStep(null);
    if (authError) clearAuthError();

    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      return;
    }

    stateMachine.startSubmitting();
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

  const pending = sendOtpMutation.isPending || googlePending || stateMachine.isBusy;

  return (
    <AuthLayout testId="login-page">
      <AuthHeader
        title="Welcome back"
        subtitle={
          authStep === "chooser"
            ? "Continue with Google, or sign in with your mobile number"
            : authMode === "otp"
              ? "Enter your mobile number to receive a one-time passcode"
              : "Sign in with your mobile number and password"
        }
      />

      <AuthPanel>
      {authError && (
        <div
          className={cn("rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 flex flex-col gap-2 mb-4", authFadeUp)}
          role="alert"
          aria-live="assertive"
          data-testid="login-auth-error"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-1 text-sm leading-snug">
              <p className="text-destructive font-medium">{authError}</p>
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

      <div className={authStep === "chooser" ? undefined : "hidden"} aria-hidden={authStep !== "chooser"}>
        <AuthMethodChooser
          onGoogleSuccess={idToken => {
            trackAuthEvent("google_started", { method: "google", portal: "customer" });
            handleGoogleToken(idToken);
          }}
          onGoogleError={msg => {
            trackAuthEvent("google_cancelled", { method: "google", portal: "customer" });
            const details = getActionableAuthDetails(new Error(msg));
            stateMachine.failWithError(new Error(details.message));
          }}
          googleDisabled={googleDisabled}
          googlePending={googlePending}
          googlePendingLabel="Signing in with Google..."
          secondaryLabel="Continue with mobile number"
          secondaryTestId="btn-login-email"
          onChooseSecondary={() => {
            setAuthMode("otp");
            setAuthStep("credentials");
          }}
          tertiaryLabel="Sign in with password instead"
          onChooseTertiary={() => {
            setAuthMode("password");
            setAuthStep("credentials");
          }}
        />
      </div>

      {authStep === "credentials" ? (
        <div data-testid="login-credential-form">
          <AuthBackButton onClick={() => setAuthStep("chooser")} disabled={pending} />

          {/* Segmented Switcher for Login Method */}
          <div
            className={cn(
              "grid grid-cols-2 p-1 bg-muted/70 rounded-xl mb-4 text-sm font-medium",
              authFadeUp,
              "delay-75",
            )}
            role="tablist"
            aria-label="Login method"
          >
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "otp"}
              onClick={() => {
                setAuthMode("otp");
                if (authError) clearAuthError();
                setOtpError(null);
                setOtpRecoveryStep(null);
              }}
              className={cn(
                "py-2 px-3 rounded-lg transition-all duration-200 text-center font-medium min-h-[38px] flex items-center justify-center gap-1.5",
                authMode === "otp"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid="tab-login-otp"
            >
              Sign in with OTP
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "password"}
              onClick={() => {
                setAuthMode("password");
                if (authError) clearAuthError();
                setOtpError(null);
                setOtpRecoveryStep(null);
              }}
              className={cn(
                "py-2 px-3 rounded-lg transition-all duration-200 text-center font-medium min-h-[38px] flex items-center justify-center gap-1.5",
                authMode === "password"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid="tab-login-password"
            >
              Password
            </button>
          </div>

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
                if (otpError) setOtpError(null);
              }}
              error={phoneError}
              onErrorChange={setPhoneError}
              autoComplete="tel"
              className={cn(authControlClass, authLandingRingClass)}
            />

            {authMode === "otp" ? (
              <form onSubmit={handleOtpContinue} className="space-y-3 pt-1">
                {otpError && (
                  <div
                    className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 flex flex-col gap-1"
                    role="alert"
                    aria-live="assertive"
                    data-testid="login-otp-error"
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={15} className="text-destructive shrink-0" aria-hidden />
                      <p className="text-destructive text-sm font-medium leading-snug">{otpError}</p>
                    </div>
                    {otpRecoveryStep ? (
                      <p className="text-destructive/85 text-xs pl-5 leading-normal">{otpRecoveryStep}</p>
                    ) : null}
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

                <p className="text-muted-foreground text-xs text-center pt-1.5">
                  Prefer using your password?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("password");
                      if (authError) clearAuthError();
                      setOtpError(null);
                      setOtpRecoveryStep(null);
                    }}
                    className={cn(authLinkClass, "font-normal hover:underline")}
                    data-testid="btn-switch-to-password"
                  >
                    Sign in with password
                  </button>
                </p>
              </form>
            ) : (
              <div className="space-y-3">
                <PasswordLogin
                  phone={phone}
                  onSuccess={handlePasswordSuccess}
                  disabled={googlePending}
                />

                <p className="text-muted-foreground text-xs text-center pt-2">
                  Don&apos;t remember your password?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("otp");
                      if (authError) clearAuthError();
                      setOtpError(null);
                      setOtpRecoveryStep(null);
                    }}
                    className={cn(authLinkClass, "font-normal hover:underline")}
                    data-testid="btn-toggle-otp-login"
                  >
                    Sign in with OTP
                  </button>
                </p>
              </div>
            )}
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
        {!isCustomerNativeApp() && (
          <p className="text-xs text-muted-foreground">
            Field staff?{" "}
            <Link href="/staff/login" className={authMutedLinkClass}>
              Staff portal
            </Link>
          </p>
        )}
        <p className="text-[11px] leading-relaxed pt-1 text-muted-foreground" data-testid="login-trust-line">
          Secure sign-in · Your data stays private · OTP never shared
        </p>
      </div>

      <AuthFooter />

      {otpSession && (
        <AuthOtpOverlay
          open={showOtp}
          session={otpSession}
          onSuccess={handleOtpSuccess}
          onClose={clearOtpSession}
          onSwitchToPassword={() => {
            clearOtpSession();
            setAuthMode("password");
          }}
        />
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
