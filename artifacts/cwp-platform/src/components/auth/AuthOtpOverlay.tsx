import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { OTPVerification } from "./OTPVerification";
import type { OtpSession } from "@/lib/authFlowStore";
import type { AuthResponse } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type AuthOtpOverlayProps = {
  open: boolean;
  session: OtpSession;
  onSuccess: (data: AuthResponse) => void;
  onClose: () => void;
};

export function AuthOtpOverlay({ open, session, onSuccess, onClose }: AuthOtpOverlayProps) {
  const isMobile = useIsMobile();

  const content = (
    <OTPVerification
      key={`${session.phone}-${session.purpose}`}
      phone={session.phone}
      maskedPhone={session.maskedPhone}
      purpose={session.purpose}
      name={session.name}
      password={session.password}
      onSuccess={onSuccess}
      onChangeNumber={onClose}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={next => { if (!next) onClose(); }}>
        <SheetContent
          side="bottom"
          className={cn(
            "bg-secondary border-white/10 text-white rounded-t-2xl px-5",
            "pb-6 pt-5 max-h-[92dvh] overflow-y-auto",
            "[&>button.absolute]:hidden",
          )}
          data-testid="otp-overlay-sheet"
        >
          <SheetTitle className="sr-only">Verify your mobile number</SheetTitle>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent
        className={cn(
          "bg-secondary border-white/10 text-white sm:max-w-md p-6 rounded-2xl",
          "[&>button.absolute]:hidden",
        )}
        data-testid="otp-overlay-dialog"
      >
        <DialogTitle className="sr-only">Verify your mobile number</DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}
