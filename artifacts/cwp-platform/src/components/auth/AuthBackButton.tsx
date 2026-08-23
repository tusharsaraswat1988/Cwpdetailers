import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthBackButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function AuthBackButton({ onClick, disabled, className }: AuthBackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm font-medium",
        "min-h-[44px] -ml-1 px-1 mb-0.5 transition-colors duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      data-testid="btn-auth-back"
    >
      <ArrowLeft size={16} aria-hidden />
      Back
    </button>
  );
}
