import { memo, Suspense, lazy, useState } from "react";
import { CustomerPhotoEditor } from "@/components/shared/CustomerPhotoEditor";
import { CustomerSkeleton } from "@/features/customer-ds";
import type { CustomerProfile } from "./types";

const ProfileEditor = lazy(() =>
  import("./ProfileEditor").then(m => ({ default: m.ProfileEditor })),
);

type Props = {
  profile: CustomerProfile | null;
  displayName: string;
  displayPhone: string;
  displayEmail: string | null;
  name: string;
  phone: string;
  saving: boolean;
  dirty: boolean;
  onNameChange: (value: string) => void;
  onSave: () => Promise<boolean>;
  onReset: () => void;
  onPhotoUpdated: () => void;
};

/** Profile gateway — identity on the hub; Edit Profile opens full account management. */
export const ProfileCard = memo(function ProfileCard({
  profile,
  displayName,
  displayPhone,
  displayEmail,
  name,
  phone,
  saving,
  dirty,
  onNameChange,
  onSave,
  onReset,
  onPhotoUpdated,
}: Props) {
  const [editing, setEditing] = useState(false);

  const handleCancel = () => {
    onReset();
    setEditing(false);
  };

  const handleSave = async () => {
    const ok = await onSave();
    if (ok) setEditing(false);
  };

  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(11,29,54,0.04)] overflow-hidden"
      data-testid="account-profile-card"
    >
      {!editing ? (
        <div className="flex items-center gap-4 p-5 sm:p-6">
          {profile ? (
            <CustomerPhotoEditor
              customerId={profile.id}
              name={displayName}
              photoUrl={profile.photoUrl}
              size="lg"
              selfService
              avatarOnly
              onUpdated={() => onPhotoUpdated()}
              testIdPrefix="account-photo"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-full bg-slate-100" aria-hidden />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold leading-tight text-foreground">
              {displayName}
            </p>
            {displayPhone ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{displayPhone}</p>
            ) : null}
            {displayEmail ? (
              <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
            ) : null}

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-primary hover:underline cursor-pointer"
              data-testid="btn-edit-account-profile"
            >
              Edit Profile
            </button>
          </div>
        </div>
      ) : (
        <div className="border-b border-border/50 px-4 py-3 sm:px-5">
          <p className="font-display text-base font-semibold text-foreground">Manage Account</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Update your profile and account security
          </p>
        </div>
      )}

      {editing ? (
        <Suspense
          fallback={
            <div className="space-y-3 px-4 py-4">
              <CustomerSkeleton className="h-12 w-full" />
              <CustomerSkeleton className="h-12 w-full" />
              <CustomerSkeleton className="h-12 w-full" />
            </div>
          }
        >
          <ProfileEditor
            profileId={profile?.id ?? null}
            photoUrl={profile?.photoUrl}
            displayName={displayName}
            name={name}
            phone={phone}
            email={displayEmail}
            saving={saving}
            dirty={dirty}
            onNameChange={onNameChange}
            onPhotoUpdated={onPhotoUpdated}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </Suspense>
      ) : null}
    </section>
  );
});
