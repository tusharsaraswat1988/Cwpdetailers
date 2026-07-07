import { useState } from "react";
import { Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import { isValidIndianMobileDigits } from "@/lib/phoneDisplay";
import type { AuthPortal } from "@/lib/authFlowStore";
import {
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from "@/components/auth/authStyles";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordLoginProps = {
  phone: string;
  portal?: AuthPortal;
  onSuccess: (data: AuthResponse) => void;
  disabled?: boolean;
  className?: string;
};

export function PasswordLogin({
  phone,
  portal = "customer",
  onSuccess,
  disabled,
  className,
}: PasswordLoginProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);

  const loginMutation = useLogin({
    mutation: {
      onSuccess,
      onError: (err: unknown) => {
        toast({
          title: "Sign-in failed",
          description: getAuthErrorMessage(err, "Incorrect mobile number or password."),
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMutation.isPending) return;

    const phoneResult = submitMobile(phone);
    if (!phoneResult.ok) {
      toast({
        title: "Enter your mobile number",
        description: "Add your number above, then sign in with your password.",
        variant: "destructive",
      });
      return;
    }

    if (!password.trim()) {
      toast({ title: "Please enter your password", variant: "destructive" });
      return;
    }

    loginMutation.mutate({
      data: { phone: phoneResult.value, password, portal },
    });
  };

  const pending = loginMutation.isPending || disabled;
  const canSubmit = isValidIndianMobileDigits(phone) && password.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)} data-testid="password-login">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password-login-password" className={authLabelClass}>
            Password
          </Label>
          <Link
            href="/forgot-password"
            className={cn(authLinkClass, "text-xs min-h-[44px] flex items-center shrink-0")}
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password-login-password"
          data-testid="input-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyUp={e => setCapsLockOn(e.getModifierState("CapsLock"))}
          onBlur={() => setCapsLockOn(false)}
          placeholder="Enter your password"
          autoComplete="current-password"
          containerClassName="mt-1.5"
          className={authInputClass}
        />
        {capsLockOn ? (
          <p className="text-amber-400/70 text-xs mt-1.5" role="status">
            Caps Lock is on
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={pending || !canSubmit}
        className={authPrimaryButtonClass}
        data-testid="btn-submit-login"
      >
        {loginMutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" aria-hidden />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
