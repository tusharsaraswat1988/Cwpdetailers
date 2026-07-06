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
import { getApiErrorMessage } from "@/lib/apiError";
import { Loader2 } from "lucide-react";

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

  const completeMutation = useGoogleAuthComplete({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Account created", description: "Welcome to CWP!" });
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
    completeMutation.mutate({ data: { linkToken, phone: phoneResult.value } });
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
            value={phone}
            onChange={setPhone}
            error={phoneError}
            onErrorChange={setPhoneError}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary [&+p]:text-white/40"
          />
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
