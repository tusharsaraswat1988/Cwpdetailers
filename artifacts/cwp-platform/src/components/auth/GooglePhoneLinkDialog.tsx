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

  const branding = useBranding();
  const completeMutation = useGoogleAuthComplete({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Welcome!", description: `Your ${branding.brandName} account is ready.` });
        onSuccess(data);
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not verify number",
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

    completeMutation.mutate({
      data: {
        linkToken,
        phone: phoneResult.value,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-secondary border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Verify your mobile number</DialogTitle>
          <DialogDescription className="text-white/50">
            {googleName ? `Hi ${googleName}! ` : ""}
            To secure your Google account ({googleEmail}), enter your 10-digit mobile number.
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

          <Button
            type="submit"
            disabled={completeMutation.isPending}
            className="w-full bg-primary text-secondary hover:bg-primary/90 font-semibold h-12"
          >
            {completeMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin mr-2" />Verifying…</>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
