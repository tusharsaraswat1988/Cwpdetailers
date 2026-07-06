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
import { AuthSupportPanel } from "@/components/auth/AuthSupportPanel";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { useBranding } from "@/lib/branding";
import { getApiErrorMessage } from "@/lib/apiError";
import { Loader2 } from "lucide-react";

export default function StaffLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  const handleStaffSuccess = useCallback(
    (data: AuthResponse) => {
      if (data.user.role !== "staff") {
        toast({
          title: "Access denied",
          description: "This portal is for field staff only. Use the customer login or admin portal.",
          variant: "destructive",
        });
        return;
      }
      login(data.user, data.token);
      setLocation("/staff/dashboard");
    },
    [login, setLocation, toast],
  );

  const loginMutation = useLogin({
    mutation: {
      onSuccess: handleStaffSuccess,
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
          toast({
            title: "Staff account required",
            description: "New accounts cannot be created here. Ask admin to set up your staff login.",
            variant: "destructive",
          });
          return;
        }
        handleStaffSuccess(data as AuthResponse);
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
      googleMutation.mutate({ data: { idToken, portal: "staff" } });
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
    loginMutation.mutate({ data: { phone: phoneResult.value, password } });
  };

  return (
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center p-4 sm:p-6" data-testid="staff-login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandLogo variant="login" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">{branding.brandName} Staff</h1>
          <p className="text-white/50 mt-1 text-sm sm:text-base">Field team sign-in</p>
        </div>

        <PwaInstallBanner
          portalKey="staff"
          title={`Install ${branding.brandName} Staff app`}
          description="Home screen par add karein — jobs aur alerts turant milein."
          className="mx-0 mb-6 border-white/15 bg-white/5 shadow-none [&_p]:text-white/90 [&_.text-muted-foreground]:text-white/55 [&_strong]:text-white"
        />

        <div className="space-y-4 mb-4">
          <GoogleSignInButton
            portal="staff"
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <PhoneInput
            id="staff-phone"
            data-testid="input-staff-phone"
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary [&+p]:text-white/40"
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
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              containerClassName="mt-1.5"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>
          <Button
            type="submit"
            data-testid="btn-submit-staff-login"
            disabled={loginMutation.isPending || googlePending}
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

        <AuthSupportPanel portal="staff" className="mt-6" />
      </div>
    </div>
  );
}
