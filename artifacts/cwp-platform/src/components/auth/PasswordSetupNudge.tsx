import { useState } from "react";
import { Link } from "wouter";
import { KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const DISMISS_KEY = "cwp_password_nudge_dismissed";

export function PasswordSetupNudge() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "1",
  );

  if (!user || user.role !== "customer" || user.hasUserPassword || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="relative rounded-xl bg-primary/10 border border-primary/20 p-4 flex gap-3 items-start"
      data-testid="password-setup-nudge"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
        <KeyRound size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <p className="font-medium text-sm">Add a sign-in password</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Optional — set one anytime from Profile → Security.
        </p>
        <Link href="/customer/account">
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-9"
            onClick={dismiss}
          >
            Set up in Profile
          </Button>
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
