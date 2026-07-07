import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordInput } from "@/components/ui/password-input";
import { useGoogleAuthComplete } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getApiErrorMessage } from "@/lib/apiError";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/lib/branding";

type GooglePhoneLinkDialogProps = {
  open: boolean;
  linkToken: string;
  googleEmail: string;
  googleName?: string | null;
  onSuccess: (data: AuthResponse) => void;
  onClose: () => void;
};

export function GooglePhoneLinkDialog({
  open,
  linkToken,
  googleEmail,
  googleName,
  onSuccess,
  onClose,
}: GooglePhoneLinkDialogProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const branding = useBranding();
  const completeMutation = useGoogleAuthComplete({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Account created", description: `Welcome to ${branding.brandName}!` });
        onSuccess(data);
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not complete sign-up",
          description: getApiErrorMessage(err, "Please try again or use a different phone number."),
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

    const trimmedPassword = password.trim();
    if (trimmedPassword) {
      if (trimmedPassword.length < 6) {
        toast({ title: "Password must be at least 6 characters", variant: "destructive" });
        return;
      }
      if (trimmedPassword !== confirmPassword) {
        toast({ title: "Passwords do not match", variant: "destructive" });
        return;
      }
    }

    completeMutation.mutate({
      data: {
        linkToken,
        phone: phoneResult.value,
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-secondary border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Link your phone number</DialogTitle>
          <DialogDescription className="text-white/50">
            {googleName ? `Hi ${googleName}! ` : ""}
            To complete your Google sign-up ({googleEmail}), enter your 10-digit mobile number.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <PhoneInput
            id="google-link-phone"
            label="Mobile number"
            dark
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
          />

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <p className="text-white/50 text-xs leading-relaxed">
              Optional: set a password to sign in with your phone number later.
            </p>
            <div>
              <Label htmlFor="google-link-password" className="text-white/70 text-sm">Password</Label>
              <PasswordInput
                id="google-link-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                containerClassName="mt-1.5"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
                data-testid="input-google-link-password"
              />
            </div>
            {password.trim() !== "" && (
              <div>
                <Label htmlFor="google-link-confirm-password" className="text-white/70 text-sm">Confirm password</Label>
                <PasswordInput
                  id="google-link-confirm-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  containerClassName="mt-1.5"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
                  data-testid="input-google-link-confirm-password"
                />
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={completeMutation.isPending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold"
          >
            {completeMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin mr-2" />Creating account…</>
            ) : (
              "Complete sign-up"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
