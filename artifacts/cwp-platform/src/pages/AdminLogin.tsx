import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { Loader2 } from "lucide-react";

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
    loginMutation.mutate({ data: { phone: phoneResult.value, password } });
  };

  return (
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center p-4 sm:p-6" data-testid="admin-login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandLogo variant="login" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-3xl text-white">{branding.brandName} Admin</h1>
          <p className="text-white/50 mt-1">Authorized personnel only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PhoneInput
            id="admin-phone"
            data-testid="input-admin-phone"
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
          />
          <div>
            <Label htmlFor="admin-password" className="text-white/70 text-sm">Password</Label>
            <Input
              id="admin-password"
              data-testid="input-admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>
          <Button
            type="submit"
            data-testid="btn-submit-admin-login"
            disabled={loginMutation.isPending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5 mt-2"
          >
            {loginMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Signing in...</> : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
