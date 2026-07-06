import { useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useRegister, useGoogleAuth } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { EmailInput } from "@/components/ui/email-input";
import { useToast } from "@/hooks/use-toast";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { GooglePhoneLinkDialog } from "@/components/auth/GooglePhoneLinkDialog";
import { AuthSupportPanel } from "@/components/auth/AuthSupportPanel";
import { useBranding } from "@/lib/branding";
import { getApiErrorMessage } from "@/lib/apiError";
import { Loader2 } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", city: "" });
  const [errors, setErrors] = useState<{ phone?: string | null; email?: string | null }>({});
  const [googlePending, setGooglePending] = useState(false);
  const [phoneLink, setPhoneLink] = useState<{
    linkToken: string;
    email: string;
    name?: string | null;
  } | null>(null);

  const handleAuthSuccess = useCallback(
    (data: AuthResponse) => {
      login(data.user, data.token);
      if (data.user.role === "staff") setLocation("/staff/dashboard");
      else setLocation("/customer/dashboard");
    },
    [login, setLocation],
  );

  const registerMutation = useRegister({
    mutation: {
      onSuccess: handleAuthSuccess,
      onError: (err: any) => {
        toast({
          title: "Registration failed",
          description: err?.response?.data?.error ?? "Phone may already be registered.",
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
          title: "Google sign-up failed",
          description: getApiErrorMessage(err, "Could not sign up with Google."),
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

    const phoneResult = submitMobile(form.phone);
    const emailResult = submitEmail(form.email);
    setErrors({
      phone: phoneResult.ok ? null : phoneResult.error,
      email: emailResult.ok ? null : emailResult.error,
    });

    if (!phoneResult.ok || !emailResult.ok) {
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }

    registerMutation.mutate({
      data: {
        ...form,
        phone: phoneResult.value,
        email: emailResult.value,
      },
    });
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4" data-testid="register-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandLogo variant="login" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-3xl text-white">Create account</h1>
          <p className="text-white/50 mt-1">Join the {branding.brandName} community</p>
        </div>

        <div className="space-y-4 mb-4">
          <GoogleSignInButton
            portal="customer"
            onSuccess={handleGoogleToken}
            onError={msg => toast({ title: msg, variant: "destructive" })}
            disabled={googlePending || registerMutation.isPending}
          />
          {googlePending && (
            <p className="text-center text-white/40 text-xs flex items-center justify-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Signing up with Google…
            </p>
          )}
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-secondary px-3 text-white/30">or register with phone</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-white/70 text-sm">Full Name</Label>
            <Input
              id="name"
              data-testid="input-name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Arjun Sharma"
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>

          <PhoneInput
            id="phone"
            data-testid="input-phone"
            label="Phone Number"
            value={form.phone}
            onChange={v => setForm(f => ({ ...f, phone: v }))}
            error={errors.phone}
            onErrorChange={err => setErrors(e => ({ ...e, phone: err }))}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
          />

          <EmailInput
            id="email"
            data-testid="input-email"
            label="Email (optional)"
            optional
            value={form.email}
            onChange={v => setForm(f => ({ ...f, email: v }))}
            error={errors.email}
            onErrorChange={err => setErrors(e => ({ ...e, email: err }))}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
          />

          <div>
            <Label htmlFor="city" className="text-white/70 text-sm">City</Label>
            <Input
              id="city"
              data-testid="input-city"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              placeholder="Varanasi"
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
            <PasswordInput
              id="password"
              data-testid="input-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              containerClassName="mt-1.5"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>

          <Button
            type="submit"
            data-testid="btn-submit-register"
            disabled={registerMutation.isPending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5 mt-2"
          >
            {registerMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Creating account...</> : "Create Account"}
          </Button>
        </form>

        <AuthSupportPanel portal="customer" className="mt-6" />

        <p className="mt-4 text-center text-white/30 text-xs px-2">
          By creating an account, you agree to our{" "}
          <Link href="/terms-and-conditions" className="text-white/50 hover:text-primary transition-colors">Terms & Conditions</Link>
          {" "}and{" "}
          <Link href="/privacy-policy" className="text-white/50 hover:text-primary transition-colors">Privacy Policy</Link>.
        </p>

        <p className="mt-4 text-center text-white/40 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {[
            { href: "/privacy-policy", label: "Privacy Policy" },
            { href: "/terms-and-conditions", label: "Terms" },
            { href: "/refund-policy", label: "Refund Policy" },
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
    </div>
  );
}
