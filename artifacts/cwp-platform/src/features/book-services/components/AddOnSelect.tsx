import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalogAddons, useCatalogPackages } from "@/features/service-catalog/api";
import { useDcmsPlans } from "@/features/daily-cleaning/api";
import type { SelectedBookService } from "../types";

type Props = {
  service: SelectedBookService | null;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

export function AddOnSelect({ service, selectedIds, onChange }: Props) {
  const catalogServiceId = service?.kind === "service" ? service.catalogServiceId ?? service.id : undefined;

  const { data: addons, isLoading } = useCatalogAddons(catalogServiceId);
  const { data: packages } = useCatalogPackages();
  const { data: plans } = useDcmsPlans();

  const includedNames = useMemo(() => {
    if (!service) return [] as string[];
    if (service.kind === "package") {
      const pkg = (packages ?? []).find(p => p.id === service.id);
      return (pkg?.addons ?? []).map(a => a.addonName);
    }
    if (service.kind === "plan") {
      const plan = (plans ?? []).find(p => p.id === service.id);
      return (plan?.addons ?? []).map(a => a.addonName);
    }
    return [];
  }, [service, packages, plans]);

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (!service) {
    return <p className="text-sm text-muted-foreground">Select a service first.</p>;
  }

  if (service.kind !== "service") {
    return (
      <div className="space-y-2" data-testid="book-step-addons">
        <Label>Included add-ons</Label>
        {includedNames.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Includes: {includedNames.join(", ")}. These are already part of the package/plan price — continue.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No bundled add-ons on this package/plan. Optional extras apply to one-time service jobs only — you can continue.
          </p>
        )}
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  const list = addons ?? [];

  return (
    <div className="space-y-3" data-testid="book-step-addons">
      <div>
        <Label>Optional add-ons</Label>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select any extras to include with this job. Skip if none apply.
        </p>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No add-ons configured for this service.</p>
      ) : (
        <div className="space-y-2">
          {list.map(a => (
            <label
              key={a.id}
              className="flex items-center gap-3 border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/40"
              data-testid={`book-addon-${a.id}`}
            >
              <Checkbox
                checked={selectedIds.includes(a.id)}
                onCheckedChange={() => toggle(a.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{a.name}</p>
                {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
              </div>
              <span className="text-sm font-medium shrink-0">₹{parseFloat(a.basePrice).toLocaleString("en-IN")}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
