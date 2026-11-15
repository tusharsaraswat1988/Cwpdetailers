import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppBarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function AppBar({
  title,
  subtitle,
  showBack,
  onBack,
  leading,
  trailing,
  className,
}: AppBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between gap-2.5 px-3 sm:px-4 bg-card/95 backdrop-blur border-b border-border shrink-0 safe-area-top",
        "h-14 min-h-[calc(var(--app-bar-height,3.5rem)+env(safe-area-inset-top,0px))]",
        className,
      )}
      data-testid="app-bar"
    >
      <div className="flex items-center gap-2 shrink-0">
        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-full text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        {leading}
      </div>

      <div className="flex-1 flex items-center justify-center min-w-0 px-1">
        {title && (
          typeof title === "string" ? (
            <h1 className="font-display font-semibold text-base truncate leading-tight text-foreground">{title}</h1>
          ) : (
            title
          )
        )}
        {subtitle && (
          typeof subtitle === "string" ? (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          ) : (
            subtitle
          )
        )}
      </div>

      <div className="flex items-center justify-end shrink-0 gap-1.5 min-w-[28px] sm:min-w-[40px]">
        {trailing}
      </div>
    </header>
  );
}

export default AppBar;
