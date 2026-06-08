import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sun, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "staff" | "admin">("customer");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data: AuthResponse) => {
        login(data.user, data.token);
        const role = data.user.role;
        if (role === "admin" || role === "superadmin") setLocation("/admin/dashboard");
        else if (role === "franchisee") setLocation("/franchisee/dashboard");
        else if (role === "manager") setLocation("/admin/dashboard");
        else if (role === "staff") setLocation("/staff/dashboard");
        else setLocation("/customer/dashboard");
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid credentials. Try admin/9999999999 with admin123.", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The role selector below is a UX hint only — the API picks the user's
    // real role from the stored account, so we only send phone + password.
    void role;
    loginMutation.mutate({ data: { phone, password } });
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Sun size={28} className="text-secondary" />
          </div>
          <h1 className="font-display font-bold text-3xl text-white">Welcome back</h1>
          <p className="text-white/50 mt-1">Sign in to the CWP Platform</p>
        </div>

        {/* Role selector */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-6" data-testid="role-selector">
          {(["customer", "staff", "admin"] as const).map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              data-testid={`role-${r}`}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                role === r ? "bg-primary text-secondary shadow" : "text-white/50 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phone" className="text-white/70 text-sm">Phone Number</Label>
            <Input
              id="phone"
              data-testid="input-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="9999999999"
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
            />
          </div>
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
          <p className="text-white/30 text-xs">Demo: Phone 9999999999 | Password: admin123</p>
          <p className="text-white/40 text-sm">
            New customer?{" "}
            <Link href="/register" className="text-primary hover:underline">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
