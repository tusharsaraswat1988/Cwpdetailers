import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { getApiErrorMessage } from "@/lib/apiError";
import { AlertCircle, Loader2 } from "lucide-react";

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
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center p-4 sm:p-6" data-testid="staff-login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandLogo variant="white" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">{branding.brandName} Staff</h1>
          <p className="text-white/50 mt-1 text-sm sm:text-base">Field team sign-in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 flex items-start gap-2"
              role="alert"
              data-testid="staff-login-error"
            >
              <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" aria-hidden />
              <p className="text-destructive text-sm leading-snug">{formError}</p>
            </div>
          )}
          <PhoneInput
            id="staff-phone"
            data-testid="input-staff-phone"
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
              <Label htmlFor="staff-password" className="text-white/70 text-sm">Password</Label>
              <Link href="/staff/forgot-password" className="text-primary text-xs hover:underline">
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
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
            {capsLockOn && (
              <p className="text-amber-400/80 text-xs mt-1.5" role="status">
                Caps Lock is on
              </p>
            )}
          </div>
          <Button
            type="submit"
            data-testid="btn-submit-staff-login"
            disabled={loginMutation.isPending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5 mt-2"
          >
            {loginMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Signing in...</> : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-white/30 text-xs px-2">
            Credentials are created by admin after profile verification.
          </p>
          <p className="text-white/40 text-sm">
            Customer?{" "}
            <Link href="/login" className="text-primary hover:underline">Customer login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
