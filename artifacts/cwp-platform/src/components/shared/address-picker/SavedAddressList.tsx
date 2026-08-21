import { FormattedAddressDisplay } from "@/components/shared/FormattedAddressDisplay";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import { addressesMatch } from "@/lib/selected-address";
import { cn } from "@/lib/utils";
import { Check, MapPin, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { savedLocationToLocationValue } from "./addressForm";

type Props = {
  savedLocations: SavedLocation[];
  value: LocationValue | null;
  onSelect: (loc: LocationValue) => void;
  onAddNew: () => void;
  onEdit?: (loc: SavedLocation) => void;
  onDelete?: (loc: SavedLocation) => void;
  onSetDefault?: (loc: SavedLocation) => void;
};

export function SavedAddressList({
  savedLocations,
  value,
  onSelect,
  onAddNew,
  onEdit,
  onDelete,
  onSetDefault,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<SavedLocation | null>(null);

  return (
    <div className="space-y-3" data-testid="saved-address-list">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold leading-tight">Where should we come?</h2>
        <p className="text-sm text-muted-foreground">Pick a saved place to continue.</p>
      </div>
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
        {savedLocations.map(loc => {
          const asValue = savedLocationToLocationValue(loc);
          const selected = loc.id === value?.savedLocationId || addressesMatch(value, asValue);
          const summary = [loc.area, loc.cityName].filter(Boolean).join(", ")
            || loc.formattedAddress
            || loc.address.replace(/\n/g, ", ");
          return (
            <div
              key={loc.id}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-1",
                selected ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(asValue)}
                className="min-w-0 flex-1 flex items-start gap-3 rounded-lg p-2.5 text-left min-h-12"
                data-testid={`saved-location-${loc.id}`}
              >
                <MapPin size={16} className="shrink-0 text-primary mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {loc.label}
                    {loc.isDefault ? <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Default</span> : null}
                  </p>
                  <FormattedAddressDisplay
                    value={loc.address}
                    compact
                    className="mt-0.5"
                  />
                  {summary && (
                    <span className="sr-only">{summary}</span>
                  )}
                </div>
                {selected && <Check size={16} className="shrink-0 text-primary mt-1" aria-hidden />}
              </button>
              {(onEdit || onDelete || onSetDefault) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                      aria-label={`More actions for ${loc.label}`}
                      data-testid={`saved-location-menu-${loc.id}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && <DropdownMenuItem onClick={() => onEdit(loc)}>Edit</DropdownMenuItem>}
                    {onSetDefault && !loc.isDefault && (
                      <DropdownMenuItem onClick={() => onSetDefault(loc)}>Set as default</DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setPendingDelete(loc)}
                      >
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAddNew}
        className="w-full min-h-12 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-sm font-medium text-primary"
        data-testid="btn-add-new-address"
      >
        + Add new address
      </button>
      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={open => { if (!open) setPendingDelete(null); }}
        title="Delete this address?"
        description="Upcoming bookings keep the address we already saved. This only removes it from your list."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete) onDelete?.(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
