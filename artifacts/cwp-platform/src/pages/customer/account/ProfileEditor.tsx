import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SetPasswordDialog } from "@/components/auth/SetPasswordDialog";
import { CustomerPhotoEditor } from "@/components/shared/CustomerPhotoEditor";
import { useAuth } from "@/lib/auth";
import { clearRememberedPhone, hasRememberedPhone } from "@/lib/rememberPhone";
import { CustomerButton, CustomerInput } from "@/features/customer-ds";
import { AccountTextAction } from "./AccountSection";

type Props = {
  profileId: number | null;
  photoUrl?: string | null;
  displayName: string;
  name: string;
  phone: string;
  email?: string | null;
  saving: boolean;
  dirty: boolean;
  onNameChange: (value: string) => void;
  onPhotoUpdated: () => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Full account management surface (progressive disclosure from Profile Card).
 * Includes profile identity + Account & Security — not on the main Account hub.
 */
export function ProfileEditor({
  profileId,
  photoUrl,
  displayName,
  name,
  phone,
  email,
  saving,
  dirty,
  onNameChange,
  onPhotoUpdated,
  onSave,
  onCancel,
}: Props) {
  const { user, token, login } = useAuth();
  const { toast } = useToast();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [rememberedOnDevice, setRememberedOnDevice] = useState(hasRememberedPhone);

  const hasPassword = Boolean(user?.hasUserPassword);
  const googleStatus = email?.trim() ? email.trim() : "Available at sign-in";

  return (
    <>
      <form
        onSubmit={e => {
          e.preventDefault();
          void onSave();
        }}
        className="space-y-5 px-4 py-4 sm:px-5"
        data-testid="account-profile-editor"
      >
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Profile Information
          </h3>

          {profileId != null ? (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Photo</p>
              <CustomerPhotoEditor
                customerId={profileId}
                name={displayName}
                photoUrl={photoUrl}
                size="lg"
                selfService
                avatarOnly
                onUpdated={() => onPhotoUpdated()}
                testIdPrefix="account-photo"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Tap photo to change</p>
            </div>
          ) : null}

          <div>
            <Label htmlFor="account-name">Full name</Label>
            <CustomerInput
              id="account-name"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              className="mt-1.5"
              autoComplete="name"
              data-testid="input-account-name"
            />
          </div>

          <div>
            <Label htmlFor="account-phone">Mobile number</Label>
            <CustomerInput
              id="account-phone"
              value={phone}
              readOnly
              disabled
              className="mt-1.5 bg-muted/50"
              data-testid="input-account-phone"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Contact support to change your mobile number.
            </p>
          </div>

          <div>
            <Label htmlFor="account-email">Email</Label>
            <CustomerInput
              id="account-email"
              value={email ?? ""}
              readOnly
              disabled
              className="mt-1.5 bg-muted/50"
              placeholder="No email on file"
              data-testid="input-account-email"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Contact support to change your email.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Account & Security
          </h3>

          <div
            className="overflow-hidden rounded-[var(--customer-radius-lg,1.25rem)] divide-y divide-border/40 bg-[color-mix(in_srgb,var(--customer-surface-tint)_42%,hsl(var(--card)))]"
            data-testid="account-security-card"
          >
            <button
              type="button"
              onClick={() => setShowPasswordDialog(true)}
              className="flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-left customer-transition hover:bg-foreground/[0.03]"
              data-testid="btn-manage-account-password"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Change Password</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {hasPassword ? "Password is set" : "Create a password for quicker sign-in"}
                </p>
              </div>
              <AccountTextAction>→</AccountTextAction>
            </button>

            <div
              className="flex min-h-11 items-center gap-3 px-4 py-2.5"
              data-testid="account-google-row"
              role="status"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Google Account</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{googleStatus}</p>
              </div>
            </div>

            {rememberedOnDevice ? (
              <button
                type="button"
                onClick={() => {
                  clearRememberedPhone();
                  setRememberedOnDevice(false);
                  toast({
                    title: "Device forgotten",
                    description: "Saved mobile number removed from this device.",
                  });
                }}
                className="flex w-full min-h-11 items-center px-4 py-2.5 text-left text-sm text-muted-foreground customer-transition hover:bg-foreground/[0.03]"
                data-testid="btn-forget-device"
              >
                Forget this device
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <CustomerButton
            type="submit"
            disabled={saving || !dirty}
            className="flex-1 sm:flex-none"
            data-testid="btn-save-account-profile"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={14} className="mr-2" />
                Save Changes
              </>
            )}
          </CustomerButton>
          <CustomerButton
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={onCancel}
            className="flex-1 sm:flex-none text-muted-foreground"
            data-testid="btn-cancel-account-profile"
          >
            <X size={14} className="mr-2" />
            Cancel
          </CustomerButton>
        </div>
      </form>

      <SetPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        hasExistingPassword={hasPassword}
        onSuccess={updatedUser => {
          if (user) {
            login(
              { ...user, hasUserPassword: updatedUser.hasUserPassword ?? true },
              token ?? "",
            );
          }
          setShowPasswordDialog(false);
        }}
      />
    </>
  );
}
