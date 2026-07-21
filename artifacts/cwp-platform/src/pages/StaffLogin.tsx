import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { getApiErrorMessage } from "@/lib/apiError";
import { AlertCircle, Loader2 } from "lucide-react";
import { StaffThemeRoot, StaffButton } from "@/features/staff-ds";

export default function StaffLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data: AuthResponse) => {
        if (data.user.role !== "staff") {
          const message = "This portal is for field staff only. Use the customer login or admin portal.";
          setFormError(message);
          toast({ title: "Access denied", description: message, variant: "destructive" });
          return;
        }
        setFormError(null);
        login(data.user, data.token);
        setLocation("/staff/dashboard");
      },
      onError: (err: unknown) => {
        const message = getApiErrorMessage(err, "Invalid phone number or password.");
        setFormError(message);
        toast({ title: "Login failed", description: message, variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }
    loginMutation.mutate({ data: { phone: phoneResult.value, password, portal: "staff" } });
  };

  return (
    <StaffThemeRoot>
      <div
        className="staff-auth-shell flex min-h-[100dvh] items-center justify-center p-4 sm:p-6"
        data-testid="staff-login-page"
      >
        <div className="w-full max-w-md">
          <div className="mb-8 text-center sm:mb-10">
            <div className="mb-4 inline-flex items-center justify-center">
              <BrandLogo variant="white" lazy={false} />
            </div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
              {branding.brandName} Staff
            </h1>
            <p className="mt-1 text-sm text-white/55 sm:text-base">Field team sign-in</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="staff-auth-panel space-y-4 p-5 sm:p-6"
            data-testid="staff-login-form"
          >
            {formError && (
              <div
                className="flex items-start gap-2 rounded-[var(--staff-radius-sm)] border border-destructive/40 bg-destructive/10 px-3 py-2.5"
                role="alert"
                data-testid="staff-login-error"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
                <p className="text-sm leading-snug text-destructive">{formError}</p>
              </div>
            )}
            <PhoneInput
              id="staff-phone"
              data-testid="input-staff-phone"
              label="Mobile Number"
              value={phone}
              onChange={setPhone}
              error={phoneError}
              onErrorChange={setPhoneError}
              className="h-[3.25rem] text-base"
            />
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="staff-password" className="text-sm text-muted-foreground">
                  Password
                </Label>
                <Link href="/staff/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="staff-password"
                data-testid="input-staff-password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (formError) setFormError(null);
                }}
                onKeyUp={e => setCapsLockOn(e.getModifierState("CapsLock"))}
                onBlur={() => setCapsLockOn(false)}
                placeholder="••••••••"
                containerClassName="mt-1.5"
                className="h-[3.25rem] text-base"
              />
              {capsLockOn && (
                <p className="mt-1.5 text-xs text-amber-600" role="status">
                  Caps Lock is on
                </p>
              )}
            </div>
            <StaffButton
              type="submit"
              data-testid="btn-submit-staff-login"
              disabled={loginMutation.isPending}
              className="mt-2 w-full"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </StaffButton>
            <p className="text-center text-xs text-muted-foreground">
              Use the mobile number registered by admin. OTP sign-in may be enabled for your team.
            </p>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="px-2 text-xs text-white/35">
              Credentials are created by admin after profile verification.
            </p>
            <p className="text-sm text-white/45">
              Customer?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Customer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </StaffThemeRoot>
  );
}
