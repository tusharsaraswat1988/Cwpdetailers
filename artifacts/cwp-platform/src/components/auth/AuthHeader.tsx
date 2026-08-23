import { BrandLogo } from "@/components/shared/BrandLogo";
import { authFadeIn, authFadeUp } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";

type AuthHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
  /** Light marketing chrome (home page) vs dark portal shell. */
  tone?: "light" | "dark";
};

export function AuthHeader({ title, subtitle, className, tone = "light" }: AuthHeaderProps) {
  const light = tone === "light";

  return (
    <div className={cn("text-center mb-5 sm:mb-6", className)}>
      <div className={cn("inline-flex items-center justify-center mb-3.5", authFadeIn)}>
        <BrandLogo variant={light ? "login" : "white"} lazy={false} />
      </div>
      <h1
        className={cn(
          "font-display font-bold text-2xl sm:text-[1.65rem] tracking-tight",
          light ? "text-foreground" : "text-white",
          authFadeUp,
          "delay-75",
        )}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed",
            light ? "text-muted-foreground" : "text-white/55",
            authFadeUp,
            "delay-150",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
