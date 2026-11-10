import { memo, useState } from "react";
import { LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type Props = {
  onLogout: () => void;
};

export const LogoutSection = memo(function LogoutSection({ onLogout }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <section data-testid="account-logout-section" className="pt-2">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/50 hover:bg-red-100/60 active:scale-[0.99] px-4 py-3 text-sm font-semibold text-destructive transition-all duration-200 cursor-pointer shadow-2xs"
          data-testid="btn-account-sign-out"
          aria-label="Sign out of account"
        >
          <LogOut size={16} aria-hidden />
          Sign Out of Account
        </button>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign Out?"
        description="Are you sure you want to sign out of your CWP Detailers account?"
        confirmLabel="Sign Out"
        cancelLabel="Stay Logged In"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          onLogout();
        }}
      />
    </>
  );
});

export default LogoutSection;
