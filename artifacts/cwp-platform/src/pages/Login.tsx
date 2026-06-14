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
import { Link } from "wouter";

export default function Login() {
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
        const userRole = data.user.role;
        if (userRole !== "customer" && userRole !== "staff") {
          toast({
            title: "Access denied",
            description: "This sign-in is for customers and staff only.",
            variant: "destructive",
          });
          return;
        }
        login(data.user, data.token);
        if (userRole === "staff") setLocation("/staff/dashboard");
        else setLocation("/customer/dashboard");
      },
      onError: (err: any) => {
        toast({
          title: "Login failed",
          description: err?.response?.data?.error ?? "Invalid phone number or password.",
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
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center p-4 sm:p-6" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandLogo variant="login" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">Welcome back</h1>
          <p className="text-white/50 mt-1 text-sm sm:text-base">Sign in to {branding.companyName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PhoneInput
            id="phone"
            data-testid="input-phone"
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary [&+p]:text-white/40"
          />
          <div>
            <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
            <Input
              id="password"
              data-testid="input-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>
          <Button
            type="submit"
            data-testid="btn-submit-login"
            disabled={loginMutation.isPending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5 mt-2"
          >
            {loginMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Signing in...</> : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-white/30 text-xs px-2">Use your registered phone and password — your portal opens automatically.</p>
          <p className="text-white/40 text-sm">
            New customer?{" "}
            <Link href="/register" className="text-primary hover:underline">Create account</Link>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
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
    </div>
  );
}
