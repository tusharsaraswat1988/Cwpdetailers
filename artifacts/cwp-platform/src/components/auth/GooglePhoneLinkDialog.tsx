import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { useGoogleAuthComplete } from "@workspace/api-client-react";
import type { AuthResponse } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { submitMobile } from "@/lib/contactForm";
import { getAuthErrorMessage } from "@/lib/authErrorMessages";
import {
  CreatePasswordFields,
  validateCreatePassword,
} from "@/components/auth/CreatePasswordFields";
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
        toast({ title: "Welcome!", description: `Your ${branding.brandName} account is ready.` });
        onSuccess(data);
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not complete sign-up",
          description: getAuthErrorMessage(err, "Please try again or use a different phone number."),
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

    const pwResult = validateCreatePassword(password, confirmPassword);
    if (!pwResult.ok) {
      toast({ title: pwResult.error, variant: "destructive" });
      return;
    }

    completeMutation.mutate({
      data: {
        linkToken,
        phone: phoneResult.value,
        password,
      },
    });
  };

  const canSubmit =
    phone.replace(/\D/g, "").length === 10 &&
    validateCreatePassword(password, confirmPassword).ok;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-secondary border-white/10 text-white sm:max-w-md max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Finish your Google account</DialogTitle>
          <DialogDescription className="text-white/50">
            {googleName ? `Hi ${googleName}! ` : ""}
            Add your mobile number and a password so you can also sign in without Google
            ({googleEmail}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <PhoneInput
            id="google-link-phone"
            label="Mobile number"
            dark
            indianMobile
            hideHint
            deferValidationUntilComplete
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
          />

          <CreatePasswordFields
            idPrefix="google-link"
            password={password}
            confirmPassword={confirmPassword}
            onPasswordChange={setPassword}
            onConfirmChange={setConfirmPassword}
            disabled={completeMutation.isPending}
            hint="At least 6 characters. Sign in later with phone + password — no SMS."
          />

          <Button
            type="submit"
            disabled={completeMutation.isPending || !canSubmit}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold h-12"
            data-testid="btn-google-complete"
          >
            {completeMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin mr-2" />Creating account…</>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
