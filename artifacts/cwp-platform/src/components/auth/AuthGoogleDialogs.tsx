import type { AuthResponse } from "@workspace/api-client-react";
import { GooglePhoneLinkDialog } from "./GooglePhoneLinkDialog";

type AuthGoogleDialogsProps = {
  phoneLink: {
    linkToken: string;
    email: string;
    name?: string | null;
  } | null;
  onPhoneLinkSuccess: (data: AuthResponse) => void;
  onPhoneLinkClose: () => void;
};

export function AuthGoogleDialogs({
  phoneLink,
  onPhoneLinkSuccess,
  onPhoneLinkClose,
}: AuthGoogleDialogsProps) {
  if (!phoneLink) return null;

  return (
    <GooglePhoneLinkDialog
      open
      linkToken={phoneLink.linkToken}
      googleEmail={phoneLink.email}
      googleName={phoneLink.name}
      onSuccess={onPhoneLinkSuccess}
      onClose={onPhoneLinkClose}
    />
  );
}
