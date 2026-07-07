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
import { PasswordInput } from "@/components/ui/password-input";
import { useSetPassword } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { Loader2 } from "lucide-react";

type SetPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasExistingPassword?: boolean;
  title?: string;
  description?: string;
  showSkip?: boolean;
  dark?: boolean;
  onSuccess: (user: User) => void;
  onSkip?: () => void;
};

export function SetPasswordDialog({
  open,
  onOpenChange,
  hasExistingPassword = false,
  title,
  description,
  showSkip = false,
  dark = false,
  onSuccess,
  onSkip,
}: SetPasswordDialogProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const setPasswordMutation = useSetPassword({
    mutation: {
      onSuccess: (data) => {
        if (data.user) {
          toast({ title: "Password saved", description: "You can now sign in with your phone and password." });
          onSuccess(data.user);
        }
        resetFields();
      },
      onError: (err: unknown) => {
        toast({
          title: "Could not save password",
          description: getApiErrorMessage(err, "Please try again."),
          variant: "destructive",
        });
      },
    },
  });

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetFields();
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setPasswordMutation.mutate({
      data: {
        newPassword,
        ...(hasExistingPassword ? { currentPassword } : {}),
      },
    });
  };

  const dialogTitle = title ?? (hasExistingPassword ? "Change password" : "Set a password");
  const dialogDescription =
    description
    ?? (hasExistingPassword
      ? "Enter your current password and choose a new one."
      : "Create a password to sign in with your phone number anytime.");

  const labelClass = dark ? "text-white/70 text-sm" : undefined;
  const inputClass = dark
    ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary"
    : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={dark ? "bg-secondary border-white/10 text-white sm:max-w-md" : "sm:max-w-md"}
        data-testid="set-password-dialog"
      >
        <DialogHeader>
          <DialogTitle className={dark ? "font-display text-white" : undefined}>{dialogTitle}</DialogTitle>
          <DialogDescription className={dark ? "text-white/50" : undefined}>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {hasExistingPassword && (
            <div>
              <Label htmlFor="set-password-current" className={labelClass}>Current password</Label>
              <PasswordInput
                id="set-password-current"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                containerClassName="mt-1.5"
                className={inputClass}
                data-testid="input-set-password-current"
              />
            </div>
          )}

          <div>
            <Label htmlFor="set-password-new" className={labelClass}>
              {hasExistingPassword ? "New password" : "Password"}
            </Label>
            <PasswordInput
              id="set-password-new"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              containerClassName="mt-1.5"
              className={inputClass}
              data-testid="input-set-password-new"
            />
          </div>

          <div>
            <Label htmlFor="set-password-confirm" className={labelClass}>Confirm password</Label>
            <PasswordInput
              id="set-password-confirm"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter password"
              containerClassName="mt-1.5"
              className={inputClass}
              data-testid="input-set-password-confirm"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            {showSkip && onSkip && (
              <Button
                type="button"
                variant="ghost"
                className={dark ? "text-white/60 hover:text-white hover:bg-white/10" : undefined}
                onClick={() => {
                  resetFields();
                  onSkip();
                }}
                disabled={setPasswordMutation.isPending}
                data-testid="btn-skip-set-password"
              >
                Skip for now
              </Button>
            )}
            <Button
              type="submit"
              disabled={setPasswordMutation.isPending}
              className={dark ? "sm:ml-auto bg-primary text-secondary hover:bg-primary/90 font-semibold" : "sm:ml-auto"}
              data-testid="btn-save-password"
            >
              {setPasswordMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-2" />Saving…</>
              ) : (
                "Save password"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
