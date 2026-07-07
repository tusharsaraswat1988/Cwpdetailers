import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { Smartphone } from "lucide-react";

type GoogleAccountFoundDialogProps = {
  open: boolean;
  email: string;
  name?: string | null;
  onContinueGoogle: () => void;
  onVerifyMobile: () => void;
};

export function GoogleAccountFoundDialog({
  open,
  email,
  name,
  onContinueGoogle,
  onVerifyMobile,
}: GoogleAccountFoundDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onVerifyMobile(); }}>
      <DialogContent
        className="bg-secondary border-white/10 text-white sm:max-w-md"
        data-testid="google-account-found-dialog"
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-white">We found an existing account</DialogTitle>
          <DialogDescription className="text-white/50 text-sm leading-relaxed">
            {name ? `Hi ${name}, ` : ""}
            An account linked to <span className="text-white/70">{email}</span> already exists.
            Choose how you&apos;d like to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            type="button"
            onClick={onContinueGoogle}
            className="w-full bg-white text-secondary hover:bg-white/90 font-medium h-12"
            data-testid="btn-continue-google-existing"
          >
            <FcGoogle size={18} className="mr-2" />
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onVerifyMobile}
            className="w-full border-white/20 text-white hover:bg-white/10 h-12"
            data-testid="btn-verify-mobile-instead"
          >
            <Smartphone size={16} className="mr-2" />
            Verify using your mobile number
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
