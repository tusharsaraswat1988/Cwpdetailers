import { memo } from "react";
import { LogOut } from "lucide-react";

type Props = {
  onLogout: () => void;
};

/** Text action — no outlined button chrome. */
export const LogoutSection = memo(function LogoutSection({ onLogout }: Props) {
  return (
    <section data-testid="account-logout-section" className="pt-1">
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full min-h-11 items-center justify-center gap-2 rounded-[var(--customer-radius-lg,1.25rem)] px-4 py-2.5 text-sm font-semibold text-destructive customer-transition hover:bg-destructive/5 active:bg-destructive/10"
        data-testid="btn-account-sign-out"
      >
        <LogOut size={16} aria-hidden />
        Log out
      </button>
    </section>
  );
});
