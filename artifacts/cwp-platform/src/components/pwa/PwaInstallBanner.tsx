import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa/usePwaInstall";

interface PwaInstallBannerProps {
  portalKey: string;
  title?: string;
  description?: string;
}

export function PwaInstallBanner({
  portalKey,
  title = "Install CWP app",
  description = "Add to your home screen for a faster, app-like experience.",
}: PwaInstallBannerProps) {
  const { canInstall, install, dismiss } = usePwaInstall(portalKey);

  if (!canInstall) return null;

  return (
    <div
      className="mx-4 mb-3 rounded-xl border border-primary/25 bg-primary/10 p-3 shadow-sm"
      role="region"
      aria-label="Install app"
      data-testid="pwa-install-banner"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Download size={18} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-sm leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => install()}
              data-testid="pwa-install-button"
            >
              Install
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground"
              onClick={dismiss}
              data-testid="pwa-install-dismiss"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground p-1 -mr-1 -mt-1"
          aria-label="Dismiss install banner"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
