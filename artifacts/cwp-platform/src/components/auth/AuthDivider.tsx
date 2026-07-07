import { cn } from "@/lib/utils";

type AuthDividerProps = {
  label?: string;
  className?: string;
};

export function AuthDivider({ label = "or", className }: AuthDividerProps) {
  return (
    <div className={cn("relative my-3.5", className)} role="separator" aria-label={label}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/[0.08]" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-secondary px-3 text-white/25 lowercase tracking-normal">{label}</span>
      </div>
    </div>
  );
}
