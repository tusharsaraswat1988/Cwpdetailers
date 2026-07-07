import { useState } from "react";
import { useLocation } from "wouter";
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
import { Loader2, Shield } from "lucide-react";

const ADMIN_ROLES = new Set(["admin", "superadmin", "manager"]);

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data: AuthResponse) => {
        const role = data.user.role;
        if (!ADMIN_ROLES.has(role)) {
          toast({
            title: "Access denied",
            description: "This portal is for administrators only.",
            variant: "destructive",
          });
          return;
        }
        login(data.user, data.token);
        setLocation("/admin/dashboard");
      },
      onError: (err: any) => {
        toast({
          title: "Login failed",
          description: err?.response?.data?.error ?? "Invalid credentials. Check your phone number and password.",
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }
    loginMutation.mutate({ data: { phone: phoneResult.value, password, portal: "admin" } });
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-[#1c1410] via-[#231a12] to-[#141820]"
      data-testid="admin-login-page"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-amber-200/90 text-sm font-medium flex items-center justify-center gap-2">
            <Shield size={16} className="text-amber-400 shrink-0" aria-hidden />
            Admin Portal — management access only
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-black/25 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-amber-950/20">
          <div className="text-center mb-8">
            <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300 mb-4">
              Administrator
            </span>
            <div className="inline-flex items-center justify-center mb-4">
              <BrandLogo variant="white" lazy={false} />
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-amber-50">{branding.brandName} Admin</h1>
            <p className="text-amber-200/55 mt-1 text-sm">Authorized personnel only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="[&_label]:text-amber-200/75 [&_.text-muted-foreground]:text-amber-200/40">
              <PhoneInput
                id="admin-phone"
                data-testid="input-admin-phone"
                label="Phone Number"
                value={phone}
                onChange={setPhone}
                error={phoneError}
                onErrorChange={setPhoneError}
                className="bg-amber-950/30 border-amber-500/25 text-amber-50 placeholder:text-amber-200/25 focus:border-amber-400"
              />
            </div>
            <div>
              <Label htmlFor="admin-password" className="text-amber-200/75 text-sm">Password</Label>
              <PasswordInput
                id="admin-password"
                data-testid="input-admin-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                containerClassName="mt-1.5"
                className="bg-amber-950/30 border-amber-500/25 text-amber-50 placeholder:text-amber-200/25 focus-visible:border-amber-400 focus-visible:ring-amber-400/30"
              />
            </div>
            <Button
              type="submit"
              data-testid="btn-submit-admin-login"
              disabled={loginMutation.isPending}
              className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400 font-semibold py-2.5 mt-2 shadow-md shadow-amber-900/30"
            >
              {loginMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Signing in...</> : "Sign In to Admin"}
            </Button>
          </form>

          <p className="mt-6 text-center text-amber-200/40 text-xs">
            Customer or staff? Use the{" "}
            <a href="/login" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">
              customer login
            </a>{" "}
            or{" "}
            <a href="/staff/login" className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2">
              staff login
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
