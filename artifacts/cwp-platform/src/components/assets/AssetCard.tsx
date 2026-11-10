import { Link } from "wouter";
import { Car, Sun, MapPin, Calendar, ClipboardList, History, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media-url";
import type { AssetCardModel } from "@/lib/asset-dashboard";
import { cn } from "@/lib/utils";

const healthBadgeStyles: Record<AssetCardModel["healthStatus"], { bg: string; text: string; border: string }> = {
  protected: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  due_soon: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  no_plan: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

interface AssetCardProps {
  asset: AssetCardModel;
  onEdit: (asset: AssetCardModel) => void;
  className?: string;
}

export function AssetCard({ asset, onEdit, className }: AssetCardProps) {
  const isVehicle = asset.kind === "vehicle";
  const typeLabel = isVehicle ? "Vehicle" : "Solar Site";
  const health = healthBadgeStyles[asset.healthStatus];

  return (
    <article
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(11,29,54,0.04)] hover:shadow-[0_4px_14px_rgba(11,29,54,0.08)] hover:border-primary/40 transition-all duration-200 overflow-hidden flex flex-col justify-between",
        className,
      )}
      data-testid={`asset-card-${asset.kind}-${asset.id}`}
      aria-label={`${typeLabel}: ${asset.name}`}
    >
      <div className="p-5 space-y-4">
        {/* Top Header Row */}
        <div className="flex items-start gap-3.5">
          {/* Avatar / Thumbnail */}
          <div className="shrink-0 w-14 h-14 rounded-xl border border-slate-200/80 bg-slate-50 overflow-hidden flex items-center justify-center">
            {asset.imageUrl ? (
              <img
                src={resolveMediaUrl(asset.imageUrl)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : isVehicle ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-blue-50 text-primary">
                <Car size={24} />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50 text-amber-600">
                <Sun size={24} />
              </div>
            )}
          </div>

          {/* Title & Badges */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  {typeLabel}
                </span>
                <h3 className="font-display font-bold text-base sm:text-lg text-foreground truncate mt-0.5">
                  {asset.name}
                </h3>
              </div>

              <span
                className={cn(
                  "text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 uppercase tracking-wider",
                  health.bg,
                  health.text,
                  health.border,
                )}
              >
                {asset.healthLabel}
              </span>
            </div>

            {/* Registration number or capacity subtitle */}
            {asset.subtitle && (
              <div className="mt-1">
                {isVehicle ? (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-xs font-semibold tracking-wide border border-slate-200">
                    {asset.subtitle}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">
                    {asset.subtitle}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Details: Plan & Location */}
        <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
          {/* Associated Plan */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground font-medium">Associated Plan:</span>
            <Link
              href={asset.planHref}
              className="font-semibold text-primary hover:underline truncate max-w-[60%] text-right inline-flex items-center gap-1 cursor-pointer"
              data-testid={`asset-plans-${asset.id}`}
            >
              {asset.plan ? asset.planLabel : "Purchase Plan"}
            </Link>
          </div>

          {/* Service Address */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 min-w-0 flex-1">
              <MapPin size={13} className="shrink-0 text-primary mt-0.5" />
              <span className={cn("truncate text-muted-foreground", !asset.addressComplete && "text-amber-700 font-medium")}>
                {asset.serviceAddress || "No address set"}
              </span>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline shrink-0 p-1 -m-1 cursor-pointer"
              onClick={() => onEdit(asset)}
              data-testid={`asset-change-address-${asset.id}`}
              aria-label={`Change address for ${asset.name}`}
            >
              Change
            </button>
          </div>

          {/* Last / Next Service Dates */}
          {(asset.nextServiceLabel || asset.lastServiceLabel) && (
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
              {asset.nextServiceLabel && (
                <span className="flex items-center gap-1 truncate">
                  <Calendar size={11} className="text-primary" />
                  Next: <strong className="text-foreground font-medium">{asset.nextServiceLabel}</strong>
                </span>
              )}
              {asset.lastServiceLabel && (
                <span className="truncate text-right">
                  Last: {asset.lastServiceLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={asset.scheduleHref} className="cursor-pointer">
            <Button
              size="sm"
              className="h-10 min-h-10 px-3.5 rounded-xl bg-primary hover:bg-[#1264db] text-white font-semibold text-xs shadow-xs gap-1.5 cursor-pointer"
              data-testid={`asset-schedule-${asset.id}`}
            >
              <Calendar size={13} /> Schedule
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 min-h-10 px-3.5 rounded-xl border-slate-200 hover:bg-white font-semibold text-xs text-foreground gap-1.5 cursor-pointer"
            onClick={() => onEdit(asset)}
            data-testid={`asset-edit-${asset.id}`}
          >
            <Pencil size={12} /> Edit
          </Button>
        </div>

        <Link
          href={asset.historyHref}
          className="text-xs font-semibold text-muted-foreground hover:text-primary inline-flex items-center gap-1 cursor-pointer"
          data-testid={`asset-history-${asset.id}`}
        >
          <History size={13} /> History
        </Link>
      </div>
    </article>
  );
}

export default AssetCard;
