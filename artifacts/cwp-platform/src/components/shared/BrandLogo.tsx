import { cn } from "@/lib/utils";
import { Sun } from "lucide-react";
import { useBranding, resolveLogoUrl, type BrandLogoVariant } from "@/lib/branding";
import { optimizeBrandLogoUrl } from "@/lib/media-url";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  lazy?: boolean;
};

const VARIANT_IMG_CLASS: Record<BrandLogoVariant, string> = {
  navbar: "h-[39px] max-w-[196px]",
  mobile: "h-[31px] w-auto max-w-[126px]",
  login: "h-[67px] max-w-[252px]",
  full: "h-[39px] max-w-[210px]",
  light: "h-[34px] max-w-[182px]",
  dark: "h-[34px] max-w-[182px]",
  white: "h-[34px] max-w-[182px]",
  transparent: "h-[34px] max-w-[182px]",
  square: "h-[34px] w-[34px]",
  icon: "h-[28px] w-[28px]",
  email: "h-[34px] max-w-[182px]",
  invoice: "h-[34px] max-w-[182px]",
  pdf: "h-[34px] max-w-[182px]",
  favicon: "h-[22px] w-[22px]",
  pwa: "h-[28px] w-[28px]",
  splash: "h-[80px] max-w-[200px]",
};

const VARIANT_FALLBACK_CLASS: Record<BrandLogoVariant, string> = {
  navbar: "w-[39px] h-[39px]",
  mobile: "w-[31px] h-[31px]",
  login: "w-[67px] h-[67px]",
  full: "w-[39px] h-[39px]",
  light: "w-[34px] h-[34px]",
  dark: "w-[34px] h-[34px]",
  white: "w-[34px] h-[34px]",
  transparent: "w-[34px] h-[34px]",
  square: "w-[34px] h-[34px]",
  icon: "w-[28px] h-[28px]",
  email: "w-[34px] h-[34px]",
  invoice: "w-[34px] h-[34px]",
  pdf: "w-[34px] h-[34px]",
  favicon: "w-[22px] h-[22px]",
  pwa: "w-[28px] h-[28px]",
  splash: "w-[80px] h-[80px]",
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
  const rawSrc = resolveLogoUrl(branding, variant);
  const src = rawSrc ? optimizeBrandLogoUrl(rawSrc) : null;
  const label = alt ?? branding.brandName;

  if (src) {
    return (
      <div className={cn("flex shrink-0 items-center", className)}>
        <img
          src={src}
          alt={label}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          className={cn(
            "block max-h-full max-w-full object-contain object-left",
            imgClassName ?? VARIANT_IMG_CLASS[variant],
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary text-secondary",
        fallbackClassName ?? VARIANT_FALLBACK_CLASS[variant],
        className,
      )}
      aria-label={label}
    >
      <Sun size={variant === "login" ? 20 : variant === "navbar" || variant === "full" ? 14 : 11} />
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
