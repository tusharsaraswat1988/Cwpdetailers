import { cn } from "@/lib/utils";

type AuthDividerProps = {
  label?: string;
  className?: string;
};

export function AuthDivider({ label = "OR", className }: AuthDividerProps) {
  return (
    <div className={cn("relative my-4", className)} role="separator" aria-label={label}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-card px-3 text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}
