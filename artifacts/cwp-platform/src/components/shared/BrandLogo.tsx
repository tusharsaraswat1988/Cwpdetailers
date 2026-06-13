import { cn } from "@/lib/utils";
import { Sun } from "lucide-react";
import { useBranding, resolveLogoUrl, type BrandLogoVariant } from "@/lib/branding";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  lazy?: boolean;
};

export function BrandLogo({
  variant = "navbar",
  alt,
  className,
  imgClassName,
  fallbackClassName,
  lazy = true,
}: BrandLogoProps) {
  const branding = useBranding();
  const src = resolveLogoUrl(branding, variant);
  const label = alt ?? branding.brandName;

  if (src) {
    return (
      <div className={cn("flex items-center", className)}>
        <img
          src={src}
          alt={label}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          className={cn("max-h-full max-w-full object-contain", imgClassName)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-primary text-secondary",
        fallbackClassName ?? "w-8 h-8",
        className,
      )}
      aria-label={label}
    >
      <Sun size={16} />
    </div>
  );
}

export function BrandMark({ className }: { className?: string }) {
  const branding = useBranding();
  return (
    <span className={cn("font-display font-bold truncate", className)}>
      {branding.brandName}
    </span>
  );
}
