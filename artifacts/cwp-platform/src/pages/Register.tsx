import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sun, Loader2 } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", city: "" });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data: any) => {
        login(data.user, data.token);
        setLocation("/customer/dashboard");
      },
      onError: () => {
        toast({ title: "Registration failed", description: "Phone may already be registered.", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: form });
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4" data-testid="register-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Sun size={28} className="text-secondary" />
          </div>
          <h1 className="font-display font-bold text-3xl text-white">Create account</h1>
          <p className="text-white/50 mt-1">Join the CWP customer community</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { id: "name", label: "Full Name", placeholder: "Arjun Sharma", type: "text" },
            { id: "phone", label: "Phone Number", placeholder: "9001001001", type: "tel" },
            { id: "email", label: "Email (optional)", placeholder: "you@email.com", type: "email" },
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

        <p className="mt-6 text-center text-white/40 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
