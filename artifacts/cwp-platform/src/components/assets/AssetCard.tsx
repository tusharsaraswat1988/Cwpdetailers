import { Link } from "wouter";
import { Car, Sun, MapPin, Calendar, ClipboardList, History, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media-url";
import type { AssetCardModel } from "@/lib/asset-dashboard";
import { cn } from "@/lib/utils";

const healthStyles: Record<AssetCardModel["healthStatus"], string> = {
  protected: "bg-green-500/10 text-green-800 border-green-500/20",
  due_soon: "bg-amber-500/10 text-amber-800 border-amber-500/20",
  no_plan: "bg-muted text-muted-foreground border-border",
};

interface AssetCardProps {
  asset: AssetCardModel;
  onEdit: (asset: AssetCardModel) => void;
}

export function AssetCard({ asset, onEdit }: AssetCardProps) {
  const Icon = asset.kind === "vehicle" ? Car : Sun;
  const typeLabel = asset.kind === "vehicle" ? "Vehicle" : "Solar Site";

  return (
    <article
      className="rounded-xl border border-border bg-card overflow-hidden"
      data-testid={`asset-card-${asset.kind}-${asset.id}`}
      aria-label={`${typeLabel}: ${asset.name}`}
    >
      <div className="flex gap-3 p-3.5">
        <div className="shrink-0 w-16 h-16 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
          {asset.imageUrl ? (
            <img
              src={resolveMediaUrl(asset.imageUrl)}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <Icon size={24} className="text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{typeLabel}</p>
              <h3 className="font-semibold text-sm truncate">{asset.name}</h3>
              {asset.subtitle && (
                <p className="text-xs text-muted-foreground truncate">{asset.subtitle}</p>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0",
                healthStyles[asset.healthStatus],
              )}
            >
              {asset.healthLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="px-3.5 pb-3 space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <MapPin size={12} className="shrink-0 text-primary mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Service address</p>
            <p className={cn("truncate", !asset.addressComplete && "text-amber-700")}>{asset.serviceAddress}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-primary shrink-0"
            onClick={() => onEdit(asset)}
            data-testid={`asset-change-address-${asset.id}`}
          >
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current plan</p>
            <Link href={asset.planHref} className="text-sm font-medium text-primary hover:underline truncate block">
              {asset.plan ? asset.planLabel : "Purchase Plan"}
            </Link>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Last service</p>
            <p className="text-sm">{asset.lastServiceLabel ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next service</p>
            <p className="text-sm">{asset.nextServiceLabel ?? "—"}</p>
          </div>
        </div>

        <Link
          href={asset.historyHref}
          className="text-primary text-xs font-medium inline-flex items-center gap-1 pt-1"
          data-testid={`asset-history-${asset.id}`}
        >
          <History size={12} aria-hidden />
          View Service History
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 pt-0 border-t border-border/60 mt-1">
        <Link href={asset.scheduleHref}>
          <Button variant="default" size="sm" className="w-full h-10 gap-1" data-testid={`asset-schedule-${asset.id}`}>
            <Calendar size={14} aria-hidden />
            Schedule
          </Button>
        </Link>
        <Link href={asset.planHref}>
          <Button variant="outline" size="sm" className="w-full h-10 gap-1" data-testid={`asset-plans-${asset.id}`}>
            <ClipboardList size={14} aria-hidden />
            View Plan
          </Button>
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 gap-1"
          onClick={() => onEdit(asset)}
          data-testid={`asset-edit-${asset.id}`}
        >
          <Pencil size={14} aria-hidden />
          Edit
        </Button>
        <Link href={asset.historyHref}>
          <Button variant="outline" size="sm" className="w-full h-10 gap-1">
            <History size={14} aria-hidden />
            History
          </Button>
        </Link>
      </div>
    </article>
  );
}

export default AssetCard;
