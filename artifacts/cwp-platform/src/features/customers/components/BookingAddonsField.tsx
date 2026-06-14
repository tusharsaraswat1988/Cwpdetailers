import { Label } from "@/components/ui/label";
import { useCatalogAddons } from "@/features/service-catalog/api";

type Props = {
  serviceId?: number;
  selectedAddonIds: number[];
  onChange: (ids: number[]) => void;
};

export function BookingAddonsField({ serviceId, selectedAddonIds, onChange }: Props) {
  const { data: addons, isLoading } = useCatalogAddons(serviceId);

  if (!serviceId || isLoading) return null;
  if ((addons ?? []).length === 0) return null;

  const addonTotal = (addons ?? [])
    .filter(a => selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + Number(a.basePrice), 0);

  return (
    <div className="space-y-2" data-testid="booking-addons-field">
      <Label>Add-ons (optional)</Label>
      <div className="space-y-2">
        {(addons ?? []).map(addon => (
          <label
            key={addon.id}
            className="flex items-center gap-2 text-sm border border-border rounded-lg p-2.5 cursor-pointer hover:bg-muted/40"
          >
            <input
              type="checkbox"
              checked={selectedAddonIds.includes(addon.id)}
              onChange={e => {
                onChange(
                  e.target.checked
                    ? [...selectedAddonIds, addon.id]
                    : selectedAddonIds.filter(id => id !== addon.id),
                );
              }}
            />
            <span className="flex-1">{addon.name}</span>
            <span className="font-medium text-primary">₹{Number(addon.basePrice).toLocaleString("en-IN")}</span>
          </label>
        ))}
      </div>
      {selectedAddonIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Add-ons subtotal: <span className="font-medium text-foreground">₹{addonTotal.toLocaleString("en-IN")}</span>
          {" "}(added to service price at booking)
        </p>
      )}
    </div>
  );
}
