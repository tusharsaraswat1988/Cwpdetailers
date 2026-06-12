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
      onError: () => {
        toast({ title: "Login failed", description: "Invalid phone number or password.", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { phone, password } });
  };

  return (
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center p-4 sm:p-6" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Sun size={28} className="text-secondary" />
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">Welcome back</h1>
          <p className="text-white/50 mt-1 text-sm sm:text-base">Sign in to the CWP Platform</p>
        </div>

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
          <p className="text-white/30 text-xs px-2">Use your registered phone and password — your portal opens automatically.</p>
          <p className="text-white/40 text-sm">
            New customer?{" "}
            <Link href="/register" className="text-primary hover:underline">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
