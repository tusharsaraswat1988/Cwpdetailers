import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useLogin, useGoogleAuth } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GooglePhoneLinkDialog } from "@/components/auth/GooglePhoneLinkDialog";
import { SetPasswordDialog } from "@/components/auth/SetPasswordDialog";
import { PhoneOtpAuthPanel } from "@/components/auth/PhoneOtpAuthPanel";
import { useBranding } from "@/lib/branding";
import { getApiErrorMessage } from "@/lib/apiError";
import { useCustomerPasswordPrompt } from "@/hooks/useCustomerPasswordPrompt";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [phoneLink, setPhoneLink] = useState<{
    linkToken: string;
    email: string;
    name?: string | null;
  } | null>(null);

  const redirectAfterAuth = useCallback(
    (role: AuthResponse["user"]["role"]) => {
      if (role === "staff") setLocation("/staff/dashboard");
      else setLocation("/customer/dashboard");
    },
    [setLocation],
  );

  const {
    showSetPassword,
    setShowSetPassword,
    handleAuthSuccess: completeCustomerAuth,
    handlePasswordSaved,
    handleSkipPassword,
  } = useCustomerPasswordPrompt({ login, onComplete: redirectAfterAuth });

  const handleAuthSuccess = useCallback(
    (data: AuthResponse) => {
      const userRole = data.user.role;
      if (userRole !== "customer" && userRole !== "staff") {
        toast({
          title: "Access denied",
          description: "This sign-in is for customers and staff only.",
          variant: "destructive",
        });
        return;
      }
      if (userRole === "staff") {
        login(data.user, data.token);
        redirectAfterAuth(userRole);
        return;
      }
      completeCustomerAuth(data);
    },
    [completeCustomerAuth, login, redirectAfterAuth, toast],
  );

  const loginMutation = useLogin({
    mutation: {
      onSuccess: handleAuthSuccess,
      onError: (err: unknown) => {
        toast({
          title: "Login failed",
          description: getApiErrorMessage(err, "Invalid phone number or password."),
          variant: "destructive",
        });
      },
    },
  });

  const googleMutation = useGoogleAuth({
    mutation: {
      onSuccess: (data) => {
        setGooglePending(false);
        if ("needsPhone" in data && data.needsPhone) {
          setPhoneLink({
            linkToken: data.linkToken,
            email: data.email,
            name: data.name,
          });
          return;
        }
        handleAuthSuccess(data as AuthResponse);
      },
      onError: (err: unknown) => {
        setGooglePending(false);
        toast({
          title: "Google sign-in failed",
          description: getApiErrorMessage(err, "Could not sign in with Google."),
          variant: "destructive",
        });
      },
    },
  });

  const handleGoogleToken = useCallback(
    (idToken: string) => {
      setGooglePending(true);
      googleMutation.mutate({ data: { idToken, portal: "customer" } });
    },
    [googleMutation],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }
    loginMutation.mutate({ data: { phone: phoneResult.value, password, portal: "customer" } });
  };

  return (
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center p-4 sm:p-6" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandLogo variant="login" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">Welcome back</h1>
          <p className="text-white/50 mt-1 text-sm sm:text-base">Sign in to {branding.companyName}</p>
        </div>

        <div className="space-y-4 mb-4">
          <GoogleSignInButton
            portal="customer"
            onSuccess={handleGoogleToken}
            onError={msg => toast({ title: msg, variant: "destructive" })}
            disabled={googlePending || loginMutation.isPending}
          />
          {googlePending && (
            <p className="text-center text-white/40 text-xs flex items-center justify-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Signing in with Google…
            </p>
          )}
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-secondary px-3 text-white/30">or sign in with phone</span>
          </div>
        </div>

        <div className="flex rounded-lg border border-white/10 p-0.5 bg-white/5 mb-4">
          <button
            type="button"
            onClick={() => setAuthMode("password")}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              authMode === "password" ? "bg-primary text-secondary font-medium" : "text-white/50 hover:text-white"
            }`}
            data-testid="login-mode-password"
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("otp")}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              authMode === "otp" ? "bg-primary text-secondary font-medium" : "text-white/50 hover:text-white"
            }`}
            data-testid="login-mode-otp"
          >
            OTP
          </button>
        </div>

        {authMode === "password" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PhoneInput
            id="phone"
            data-testid="input-phone"
            label="Phone Number"
            dark
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
          />
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
              <Link href="/forgot-password" className="text-primary text-xs hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              data-testid="input-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              containerClassName="mt-1.5"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>
          <Button
            type="submit"
            data-testid="btn-submit-login"
            disabled={loginMutation.isPending || googlePending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5 mt-2"
          >
            {loginMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Signing in...</> : "Sign In"}
          </Button>
        </form>
        ) : (
          <PhoneOtpAuthPanel
            purpose="login"
            dark
            onSuccess={data => completeCustomerAuth(data)}
          />
        )}

        <div className="mt-6 text-center space-y-2">
          <p className="text-white/30 text-xs px-2">Use your registered phone and password — your portal opens automatically.</p>
          <p className="text-white/40 text-sm">
            Field staff?{" "}
            <Link href="/staff/login" className="text-primary hover:underline">Staff login</Link>
          </p>
          <p className="text-white/40 text-sm">
            New customer?{" "}
            <Link href="/register" className="text-primary hover:underline">Create account</Link>
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {[
            { href: "/privacy-policy", label: "Privacy Policy" },
            { href: "/terms-and-conditions", label: "Terms" },
            { href: "/contact-us", label: "Contact" },
          ].map(link => (
            <Link key={link.href} href={link.href} className="text-white/20 hover:text-white/40 text-xs transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {phoneLink && (
        <GooglePhoneLinkDialog
          open
          linkToken={phoneLink.linkToken}
          googleEmail={phoneLink.email}
          googleName={phoneLink.name}
          onSuccess={data => {
            setPhoneLink(null);
            handleAuthSuccess(data);
          }}
          onClose={() => setPhoneLink(null)}
        />
      )}

      <SetPasswordDialog
        open={showSetPassword}
        onOpenChange={open => {
          if (!open) handleSkipPassword();
          else setShowSetPassword(true);
        }}
        dark
        showSkip
        title="Set a password (optional)"
        description="Add a password so you can sign in with your phone number without Google."
        onSuccess={handlePasswordSaved}
        onSkip={handleSkipPassword}
      />
    </div>
  );
}
