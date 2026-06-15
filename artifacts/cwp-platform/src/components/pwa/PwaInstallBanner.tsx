import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall, type PwaInstallPlatform } from "@/lib/pwa/usePwaInstall";

type PwaInstallBannerProps = {
  portalKey: string;
  title: string;
  description: string;
  className?: string;
};

function ManualInstallHint({ platform }: { platform: PwaInstallPlatform }) {
  if (platform === "ios") {
    return (
      <p className="text-xs text-muted-foreground leading-relaxed">
        <Share className="inline h-3.5 w-3.5 mr-1 align-text-bottom" aria-hidden />
        Tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.
      </p>
    );
  }

  if (platform === "android") {
    return (
      <p className="text-xs text-muted-foreground leading-relaxed">
        Browser menu (⋮) → <strong>Install app</strong> or <strong>Add to Home screen</strong>.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground leading-relaxed">
      Use the install icon in the address bar, or open this page on your phone for the best app experience.
    </p>
  );
}

export function PwaInstallBanner({
  portalKey,
  title,
  description,
  className = "",
}: PwaInstallBannerProps) {
  const { canInstall, hasNativePrompt, platform, install, dismiss } = usePwaInstall(portalKey);

  if (!canInstall) return null;

  return (
    <div
      className={`mx-4 mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm ${className}`}
      role="region"
      aria-label="Install app"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 -mt-1 -mr-1"
              onClick={dismiss}
              aria-label="Dismiss install prompt for this session"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ManualInstallHint platform={platform} />

          {hasNativePrompt ? (
            <Button type="button" size="sm" className="h-9 gap-2" onClick={() => void install()}>
              <Download className="h-4 w-4" aria-hidden />
              Install now
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
