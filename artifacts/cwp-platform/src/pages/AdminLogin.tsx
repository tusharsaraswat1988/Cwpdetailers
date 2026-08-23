import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { AdminThemeRoot, AdminButton, AdminField } from "@/features/admin-ds";
import { AlertCircle, Loader2, Shield } from "lucide-react";

const ADMIN_ROLES = new Set(["admin", "superadmin", "manager"]);

export default function AdminLogin() {
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
        const role = data.user.role;
        if (!ADMIN_ROLES.has(role)) {
          const message = "This portal is for administrators only.";
          setFormError(message);
          toast({ title: "Access denied", description: message, variant: "destructive" });
          return;
        }
        setFormError(null);
        login(data.user, data.token);
        setLocation("/admin/dashboard");
      },
      onError: (err: unknown) => {
        const message = getAuthErrorMessage(err, "Invalid credentials. Check your phone number and password.");
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
    loginMutation.mutate({ data: { phone: phoneResult.value, password, portal: "admin" } });
  };

  return (
    <AdminThemeRoot className="min-h-[100dvh]">
      <div
        className="admin-auth-shell flex min-h-[100dvh] flex-col items-center justify-center bg-secondary p-4 sm:p-6"
        data-testid="admin-login-page"
      >
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="mb-4 inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Shield size={14} className="shrink-0" aria-hidden />
              Administrator
            </p>
            <div className="mb-4 inline-flex items-center justify-center">
              <BrandLogo variant="white" lazy={false} />
            </div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
              {branding.brandName} Admin
            </h1>
            <p className="mt-1 text-sm text-white/55">Authorized personnel only</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-auth-panel space-y-4 p-5 sm:p-6">
            {formError && (
              <div
                className="flex items-start gap-2 rounded-[var(--admin-radius,0.5rem)] border border-destructive/40 bg-destructive/10 px-3 py-2.5"
                role="alert"
                data-testid="admin-login-error"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
                <p className="text-sm leading-snug text-destructive">{formError}</p>
              </div>
            )}
            <AdminField label="Phone Number" htmlFor="admin-phone">
              <PhoneInput
                id="admin-phone"
                data-testid="input-admin-phone"
                value={phone}
                onChange={setPhone}
                error={phoneError}
                onErrorChange={setPhoneError}
                hideHint
                className="h-11 text-base"
              />
            </AdminField>
            <div className="admin-field">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="admin-password" className="admin-field-label">
                  Password
                </label>
                <a href="/admin/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <PasswordInput
                id="admin-password"
                data-testid="input-admin-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formError) setFormError(null);
                }}
                onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                onBlur={() => setCapsLockOn(false)}
                placeholder="••••••••"
                className="h-11 text-base"
              />
              {capsLockOn ? (
                <p className="admin-field-hint" role="status">
                  Caps Lock is on
                </p>
              ) : null}
            </div>
            <AdminButton
              type="submit"
              data-testid="btn-submit-admin-login"
              disabled={loginMutation.isPending}
              className="mt-2 w-full font-semibold"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In to Admin"
              )}
            </AdminButton>
          </form>

          <p className="mt-6 text-center text-xs text-white/45">
            Customer or staff? Use the{" "}
            <a href="/login" className="text-primary underline underline-offset-2 hover:opacity-90">
              customer login
            </a>{" "}
            or{" "}
            <a href="/staff/login" className="text-primary underline underline-offset-2 hover:opacity-90">
              staff login
            </a>
            .
          </p>
        </div>
      </div>
    </AdminThemeRoot>
  );
}
