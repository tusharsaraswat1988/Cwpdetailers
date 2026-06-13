import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { useToast } from "@/hooks/use-toast";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { Loader2 } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const branding = useBranding();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", city: "" });
  const [errors, setErrors] = useState<{ phone?: string | null; email?: string | null }>({});

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data: any) => {
        login(data.user, data.token);
        setLocation("/customer/dashboard");
      },
      onError: (err: any) => {
        toast({
          title: "Registration failed",
          description: err?.response?.data?.error ?? "Phone may already be registered.",
          variant: "destructive",
        });
      },
    },
  });

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
            <BrandLogo variant="login" imgClassName="h-14 max-w-[240px]" fallbackClassName="w-14 h-14" lazy={false} />
          </div>
          <h1 className="font-display font-bold text-3xl text-white">Create account</h1>
          <p className="text-white/50 mt-1">Join the {branding.brandName} community</p>
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

          {[
            { id: "city", label: "City", placeholder: "Varanasi", type: "text" },
            { id: "password", label: "Password", placeholder: "••••••••", type: "password" },
          ].map(({ id, label, placeholder, type }) => (
            <div key={id}>
              <Label htmlFor={id} className="text-white/70 text-sm">{label}</Label>
              <Input
                id={id}
                data-testid={`input-${id}`}
                type={type}
                value={(form as any)[id]}
                onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                placeholder={placeholder}
                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
              />
            </div>
          ))}

          <Button
            type="submit"
            data-testid="btn-submit-register"
            disabled={registerMutation.isPending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold py-2.5 mt-2"
          >
            {registerMutation.isPending ? <><Loader2 size={14} className="animate-spin mr-2" />Creating account...</> : "Create Account"}
          </Button>
        </form>

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
    </div>
  );
}
