import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppBarProps {
  title?: string;
  subtitle?: string;
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
        "sticky top-0 z-30 flex items-center gap-3 px-4 bg-card/95 backdrop-blur border-b border-border shrink-0 safe-area-top",
        "h-[var(--app-bar-height)] min-h-[var(--app-bar-height)]",
        className,
      )}
      data-testid="app-bar"
    >
      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      {leading}
      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="font-display font-bold text-base truncate leading-tight">{title}</h1>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </header>
  );
}

export default AppBar;
