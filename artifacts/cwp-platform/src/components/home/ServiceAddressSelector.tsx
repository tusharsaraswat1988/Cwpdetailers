import { MapPin, ChevronRight } from "lucide-react";
import type { SelectedAddress } from "@/lib/selected-address";
import { cn } from "@/lib/utils";

interface ServiceAddressSelectorProps {
  selected: SelectedAddress | null;
  address: {
    line: string;
    assetLabel?: string;
    complete: boolean;
  };
  onClick: () => void;
  className?: string;
}

/**
 * Compact, globally standardized service address selector.
 * Placed immediately below the application header, scrolls naturally with the page.
 */
export function ServiceAddressSelector({
  selected,
  address,
  onClick,
  className,
}: ServiceAddressSelectorProps) {
  const hasAddress = Boolean(selected?.address?.trim() || address.line?.trim());

  // Derive title (e.g. "My Home", "Office", or asset label)
  const addressTitle = selected?.assetLabel || (hasAddress ? "Service Location" : "No Address Selected");
  const addressDetail = selected?.address || address.line || "Tap to select your doorstep service location";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-3.5 py-3 sm:px-4 sm:py-3.5 flex items-center gap-3 text-left transition-all duration-200 cursor-pointer",
        hasAddress
          ? "border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(11,29,54,0.04)] hover:border-primary/40 hover:shadow-[0_4px_14px_rgba(11,29,54,0.08)] active:scale-[0.99]"
          : "border-dashed border-slate-300 bg-slate-50/80 hover:bg-slate-100/80 hover:border-primary/40",
        className,
      )}
      data-testid="home-current-address-capsule"
      aria-label={hasAddress ? `Service address: ${addressTitle}, ${addressDetail}. Click to change` : "Select service address"}
    >
      {/* Location Pin Icon Box */}
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary border border-blue-100/60 flex items-center justify-center shrink-0">
        <MapPin size={18} />
      </div>

      {/* Address Details */}
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
          Service Address
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-sm font-bold text-foreground truncate leading-tight">
            {addressTitle}
          </p>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
          {addressDetail}
        </p>
      </div>

      {/* Change Action Pill */}
      <div className="shrink-0 pl-1">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary px-3 py-1.5 rounded-lg bg-blue-50/80 hover:bg-blue-100 transition-colors">
          {hasAddress ? "Change" : "Select"}
          <ChevronRight size={14} className="text-primary" />
        </span>
      </div>
    </button>
  );
}

export default ServiceAddressSelector;
