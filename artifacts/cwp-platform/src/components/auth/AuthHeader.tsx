import { BrandLogo } from "@/components/shared/BrandLogo";
import { authFadeIn, authFadeUp } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";

type AuthHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

export function AuthHeader({ title, subtitle, className }: AuthHeaderProps) {
  return (
    <div className={cn("text-center mb-5 sm:mb-6", className)}>
      <div className={cn("inline-flex items-center justify-center mb-3.5", authFadeIn)}>
        <BrandLogo variant="white" lazy={false} />
      </div>
      <h1
        className={cn(
          "font-display font-bold text-2xl sm:text-[1.65rem] text-white tracking-tight",
          authFadeUp,
          "delay-75",
        )}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className={cn("text-white/45 mt-1.5 text-sm leading-relaxed", authFadeUp, "delay-150")}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
