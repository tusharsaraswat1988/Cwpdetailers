import { memo } from "react";
import { Link } from "wouter";
import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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

export const AssetCard = memo(function AssetCard({ asset, onEdit, className }: AssetCardProps) {
  const isVehicle = asset.kind === "vehicle";
  const typeLabel = isVehicle ? "Vehicle" : "Solar Site";
  const health = healthBadgeStyles[asset.healthStatus];

  const statusLabel =
    asset.healthStatus === "protected"
      ? isVehicle
        ? "Active Plan"
        : "Active AMC"
      : asset.healthStatus === "due_soon"
      ? "Renewal Due"
      : "No Active Plan";

  return (
    <article
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(11,29,54,0.04)] hover:shadow-[0_4px_14px_rgba(11,29,54,0.08)] hover:border-primary/40 transition-all duration-200 flex flex-col justify-between overflow-hidden",
        className,
      )}
      data-testid={`asset-card-${asset.kind}-${asset.id}`}
      aria-label={`${typeLabel}: ${asset.name}`}
    >
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Top Header Row */}
        <div className="flex items-start gap-3">
          {/* Avatar / Thumbnail */}
          <div className="shrink-0 w-13 h-13 sm:w-14 sm:h-14 rounded-xl border border-slate-200/80 bg-slate-50 overflow-hidden flex items-center justify-center">
            {asset.imageUrl ? (
              <img
                src={resolveMediaUrl(asset.imageUrl)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : isVehicle ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-blue-50 text-primary">
                <MaterialSymbol name="directions_car" size={24} />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50 text-amber-600">
                <MaterialSymbol name="wb_sunny" size={24} />
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
                  "text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 tracking-wide font-mono",
                  health.bg,
                  health.text,
                  health.border,
                )}
                data-testid={`asset-status-badge-${asset.id}`}
              >
                {statusLabel}
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
                  <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50/80 text-amber-800 text-xs font-medium border border-amber-200/60 font-mono">
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
              className="font-semibold text-primary hover:underline truncate max-w-[65%] text-right inline-flex items-center gap-1 cursor-pointer"
              data-testid={`asset-plans-${asset.id}`}
            >
              {asset.plan ? asset.planLabel : isVehicle ? "Purchase Plan" : "Purchase AMC"}
            </Link>
          </div>

          {/* Address (Service Address for vehicle, Installation Address for solar) */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 min-w-0 flex-1">
              <MaterialSymbol name="location_on" size={14} className="shrink-0 text-primary mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] font-medium text-muted-foreground block">
                  {isVehicle ? "Service Address" : "Installation Address"}
                </span>
                <p className={cn("text-xs text-foreground truncate", !asset.addressComplete && "text-amber-700 font-medium")}>
                  {asset.serviceAddress || "No address set"}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline shrink-0 p-1 -m-1 cursor-pointer"
              onClick={() => onEdit(asset)}
              data-testid={`asset-change-address-${asset.id}`}
              aria-label={`Change ${isVehicle ? "service" : "installation"} address for ${asset.name}`}
            >
              Change
            </button>
          </div>

          {/* Next / Last Service or Cleaning Dates */}
          {(asset.nextServiceLabel || asset.lastServiceLabel) && (
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-slate-50">
              {asset.nextServiceLabel && (
                <span className="flex items-center gap-1 truncate">
                  <MaterialSymbol name="calendar_today" size={12} className="text-primary" />
                  {isVehicle ? "Next Service: " : "Next Cleaning: "}
                  <strong className="text-foreground font-medium">{asset.nextServiceLabel}</strong>
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

      {/* Action Footer: 1 Dominant Primary CTA ("Schedule Service") + Secondary Actions */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2.5">
        <Link href={asset.scheduleHref} className="flex-1 cursor-pointer">
          <Button
            size="sm"
            className="w-full h-11 min-h-[44px] px-4 rounded-xl bg-primary hover:bg-[#1264db] text-white font-semibold text-xs shadow-xs gap-1.5 cursor-pointer flex items-center justify-center transition-all duration-150"
            data-testid={`asset-schedule-${asset.id}`}
          >
            <MaterialSymbol name="calendar_month" size={16} /> Schedule Service
          </Button>
        </Link>

        {/* Secondary 1-tap Edit Action */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 min-h-[44px] px-3.5 rounded-xl border-slate-200 hover:bg-white font-semibold text-xs text-foreground gap-1.5 cursor-pointer flex items-center shrink-0"
          onClick={() => onEdit(asset)}
          data-testid={`asset-edit-${asset.id}`}
          aria-label={`Edit ${asset.name}`}
        >
          <MaterialSymbol name="edit" size={14} />
          <span className="hidden sm:inline">Edit</span>
        </Button>

        {/* Secondary Actions Overflow Menu (⋮) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 rounded-xl border-slate-200 hover:bg-white text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center shrink-0"
              aria-label={`More actions for ${asset.name}`}
              data-testid={`asset-more-${asset.id}`}
            >
              <MaterialSymbol name="more_vert" size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border-slate-200 p-1.5">
            <DropdownMenuItem asChild className="gap-2 cursor-pointer rounded-lg text-xs font-medium py-2.5">
              <Link
                href={asset.historyHref}
                className="w-full flex items-center gap-2"
                data-testid={`asset-history-${asset.id}`}
              >
                <MaterialSymbol name="history" size={16} className="text-muted-foreground" />
                <span>Service History</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer rounded-lg text-xs font-medium py-2.5"
              onClick={() => onEdit(asset)}
            >
              <MaterialSymbol name="edit_location" size={16} className="text-primary" />
              <span>Change Address</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 cursor-pointer rounded-lg text-xs font-medium py-2.5">
              <Link href={asset.planHref} className="w-full flex items-center gap-2">
                <MaterialSymbol name="assignment" size={16} className="text-primary" />
                <span>{asset.plan ? "Manage Plan" : isVehicle ? "Purchase Plan" : "Purchase AMC"}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
});

export default AssetCard;
