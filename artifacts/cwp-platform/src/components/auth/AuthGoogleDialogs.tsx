import type { AuthResponse } from "@workspace/api-client-react";
import { GooglePhoneLinkDialog } from "./GooglePhoneLinkDialog";
import { GoogleAccountFoundDialog } from "./GoogleAccountFoundDialog";

type AuthGoogleDialogsProps = {
  phoneLink: {
    linkToken: string;
    email: string;
    name?: string | null;
  } | null;
  pendingGoogleAuth: AuthResponse | null;
  onPhoneLinkSuccess: (data: AuthResponse) => void;
  onPhoneLinkClose: () => void;
  onConfirmGoogle: () => void;
  onDeclineGoogle: () => void;
};

export function AuthGoogleDialogs({
  phoneLink,
  pendingGoogleAuth,
  onPhoneLinkSuccess,
  onPhoneLinkClose,
  onConfirmGoogle,
  onDeclineGoogle,
}: AuthGoogleDialogsProps) {
  return (
    <>
      {phoneLink && (
        <GooglePhoneLinkDialog
          open
          linkToken={phoneLink.linkToken}
          googleEmail={phoneLink.email}
          googleName={phoneLink.name}
          onSuccess={onPhoneLinkSuccess}
          onClose={onPhoneLinkClose}
        />
      )}

      {pendingGoogleAuth && (
        <GoogleAccountFoundDialog
          open
          email={pendingGoogleAuth.user.email ?? "your Google account"}
          name={pendingGoogleAuth.user.name}
          onContinueGoogle={onConfirmGoogle}
          onVerifyMobile={onDeclineGoogle}
        />
      )}
    </>
  );
}
