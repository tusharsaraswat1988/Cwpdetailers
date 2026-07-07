import { cn } from "@/lib/utils";
import { useBranding, getBrandAsset } from "@/lib/branding";

type BrandLoaderProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
  fullScreen?: boolean;
};

const SIZE_MAP = {
  sm: { logo: "h-8 w-8", spinner: "h-5 w-5", text: "text-xs" },
  md: { logo: "h-12 w-12", spinner: "h-8 w-8", text: "text-sm" },
  lg: { logo: "h-20 w-20", spinner: "h-10 w-10", text: "text-base" },
};

/** Branded loading indicator — uses loader animation, background, and text from BMS */
export function BrandLoader({ className, size = "md", text, fullScreen = false }: BrandLoaderProps) {
  const branding = useBranding();
  const loaderImg = getBrandAsset(branding, "loader");
  const loaderBg = branding.loaderBackground ?? branding.backgroundColor;
  const loaderText = text ?? branding.loaderText ?? "Loading…";
  const sizes = SIZE_MAP[size];

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      {loaderImg ? (
        <img
          src={loaderImg}
          alt=""
          className={cn("object-contain", sizes.logo)}
          aria-hidden
        />
      ) : (
        <div
          className={cn(
            "rounded-full border-2 border-t-transparent animate-spin",
            sizes.spinner,
          )}
          style={{ borderColor: branding.primaryColor, borderTopColor: "transparent" }}
          aria-hidden
        />
      )}
      {loaderText && (
        <p className={cn("text-muted-foreground font-medium", sizes.text)}>{loaderText}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: loaderBg }}
        role="status"
        aria-live="polite"
        aria-label={loaderText}
      >
        {content}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-label={loaderText}>
      {content}
    </div>
  );
}

/** Inline spinner using brand primary color */
export function BrandSpinner({ className, size = 16 }: { className?: string; size?: number }) {
  const branding = useBranding();
  return (
    <span
      className={cn("inline-block rounded-full border-2 border-t-transparent animate-spin", className)}
      style={{
        width: size,
        height: size,
        borderColor: branding.primaryColor,
        borderTopColor: "transparent",
      }}
      aria-hidden
    />
  );
}
